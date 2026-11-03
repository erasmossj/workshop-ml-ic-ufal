-- Acervo sem PDF (WML-75): desde 03/11/2026 o trabalho é só título, autores e resumo — não há
-- mais upload de PDF. O acervo de edições passadas (WML-73 · ADR-007) passa a aceitar trabalho
-- sem PDF; o PDF continua indo junto quando existir (enviado até 03/11/2026).
--
-- 1. admin_definir_acervo: sai a recusa TRABALHO_SEM_PDF. Autorizar depois do expurgo dos PDFs
--    leva título, autores e resumo (o arquivo apagado não volta).
-- 2. expurgar_dados: a transferência para o acervo não exige mais pdf_path.
-- 3. disparar_expurgo: acorda também quando há aprovado + autorizado sem PDF a transferir.
-- Mesmas assinaturas: os privilégios da migration do acervo continuam valendo.

create or replace function public.admin_definir_acervo(p_numero text, p_acervo boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_t public.trabalhos;
begin
  if not public.pode_administrar() then
    raise exception 'NAO_AUTORIZADO';
  end if;
  if p_acervo is null then
    raise exception 'ACERVO_INVALIDO';
  end if;
  v_id := public.participante_por_numero(p_numero);
  select * into v_t from public.trabalhos t where t.participante_id = v_id for update;
  if not found then
    raise exception 'SEM_TRABALHO';
  end if;

  if p_acervo then
    if exists (select 1 from public.participantes p where p.id = v_id and p.cancelada_em is not null) then
      raise exception 'INSCRICAO_CANCELADA';
    end if;
    update public.trabalhos t set acervo = true, acervo_em = now()
     where t.id = v_t.id and not t.acervo;
  else
    if v_t.acervo_id is not null then
      perform public.retirar_do_acervo(v_t.acervo_id);
    end if;
    update public.trabalhos t set acervo = false, acervo_em = now()
     where t.id = v_t.id and t.acervo;
  end if;
end $$;

-- Igual à WML-73, sem exigir PDF na transferência para o acervo.
create or replace function public.expurgar_dados(
  p_hoje date default (now() at time zone 'America/Maceio')::date
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_config public.config_evento;
  v_pessoais integer := 0;
  v_participantes integer := 0;
  v_acervo integer := 0;
  v_novo uuid;
  r record;
begin
  select * into v_config from public.config_evento c where c.id;

  if p_hoje > v_config.expurgo_pdfs then
    for r in
      select t.id, t.titulo, t.autores, t.resumo, t.status, t.pdf_path
        from public.trabalhos t
        join public.participantes p on p.id = t.participante_id
       where t.acervo and t.status in ('aprovado_oral', 'aprovado_poster') and p.cancelada_em is null
         and t.acervo_id is null
       order by t.criado_em
         for update of t
    loop
      insert into public.acervo_trabalhos (edicao, titulo, autores, resumo, status, pdf_path)
      values (v_config.edicao, r.titulo, r.autores, r.resumo, r.status, r.pdf_path)
      returning id into v_novo;
      update public.trabalhos t set acervo_id = v_novo, pdf_path = null where t.id = r.id;
      v_acervo := v_acervo + 1;
    end loop;
  end if;

  if p_hoje > v_config.expurgo_pessoais then
    with apagados as (
      update public.participantes p
         set cpf = null, email = null, instituicao = null, curso = null, perfil_url = null,
             vinculo_outro = null
       where p.cpf is not null or p.email is not null or p.instituicao is not null
          or p.curso is not null or p.perfil_url is not null or p.vinculo_outro is not null
      returning 1
    )
    select count(*) into v_pessoais from apagados;
    update public.inscricoes_minicurso i set cpf = null where i.cpf is not null;
    delete from public.email_outbox;
    delete from public.limite_requisicoes;
    update public.presencas pr set operador = 'expurgado' where pr.operador <> 'expurgado';
  end if;

  if p_hoje > v_config.expurgo_final then
    with apagados as (delete from public.participantes returning 1)
    select count(*) into v_participantes from apagados;
  end if;

  return jsonb_build_object('dados_pessoais', v_pessoais, 'participantes', v_participantes,
                            'acervo', v_acervo);
end $$;

-- Igual à WML-73, mais a condição do acervo sem PDF.
create or replace function public.disparar_expurgo() returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_hoje date := (now() at time zone 'America/Maceio')::date;
  v_config public.config_evento;
  v_url text;
  v_segredo text;
begin
  select * into v_config from public.config_evento c where c.id;
  if not (
    (v_hoje > v_config.expurgo_pdfs and exists (select 1 from public.trabalhos t where t.pdf_path is not null))
    -- aprovados e autorizados ainda não transferidos para o acervo, com ou sem PDF (WML-75)
    or (v_hoje > v_config.expurgo_pdfs and exists (
          select 1 from public.trabalhos t
            join public.participantes p on p.id = t.participante_id
           where t.acervo and t.status in ('aprovado_oral', 'aprovado_poster')
             and p.cancelada_em is null and t.acervo_id is null))
    or exists (select 1 from public.pdfs_a_apagar)
    or (v_hoje > v_config.expurgo_pessoais
        and exists (select 1 from public.participantes p where p.cpf is not null or p.email is not null))
    or (v_hoje > v_config.expurgo_final and exists (select 1 from public.participantes))
  ) then
    return null;
  end if;
  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'send_emails_url';
  select s.decrypted_secret into v_segredo from vault.decrypted_secrets s where s.name = 'send_emails_secret';
  if v_url is null or v_segredo is null then
    return null;
  end if;
  return net.http_post(
    url := replace(v_url, '/functions/v1/send-emails', '/functions/v1/expurgo'),
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_segredo),
    timeout_milliseconds := 120000
  );
end $$;
