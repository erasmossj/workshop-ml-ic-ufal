-- Expurgo LGPD pós-evento (WML-52 · S6). Prazos da política de privacidade
-- (`privacidade.retencao` em src/data/evento.ts; um teste confere que são os mesmos):
--   PDFs dos trabalhos .................................. até 31/01/2027
--   CPF, e-mail e instituição ........................... até 31/03/2027
--   nome, nº de inscrição e carga horária (certificado) . até 31/12/2031
-- O banco apaga os dados; os PDFs saem pela API do Storage (Edge Function `expurgo`), porque
-- apagar a linha de storage.objects não apaga o arquivo. O pg_cron dispara uma vez por dia e só
-- quando há algo vencido.

alter table public.config_evento
  add column expurgo_pdfs date not null default '2027-01-31',
  add column expurgo_pessoais date not null default '2027-03-31',
  add column expurgo_final date not null default '2031-12-31';

-- Depois do expurgo, CPF e e-mail ficam vazios (as regras de formato continuam valendo enquanto há valor).
alter table public.participantes alter column cpf drop not null, alter column email drop not null;
alter table public.inscricoes_minicurso alter column cpf drop not null;

-- PDFs vencidos ainda guardados (a Edge Function apaga os arquivos e chama concluir_expurgo_pdfs).
create function public.expurgo_pdfs_pendentes(
  p_hoje date default (now() at time zone 'America/Maceio')::date
) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(t.pdf_path order by t.pdf_path), '{}')
    from public.trabalhos t, public.config_evento c
   where c.id and p_hoje > c.expurgo_pdfs and t.pdf_path is not null
$$;

create function public.concluir_expurgo_pdfs(p_caminhos text[]) returns integer
language sql security definer set search_path = '' as $$
  with limpos as (
    update public.trabalhos t set pdf_path = null
     where t.pdf_path = any (p_caminhos)
    returning 1
  )
  select count(*)::integer from limpos
$$;

-- Apaga o que venceu até p_hoje. Idempotente: rodar de novo não faz nada.
create function public.expurgar_dados(
  p_hoje date default (now() at time zone 'America/Maceio')::date
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_config public.config_evento;
  v_pessoais integer := 0;
  v_participantes integer := 0;
begin
  select * into v_config from public.config_evento c where c.id;

  if p_hoje > v_config.expurgo_pessoais then
    with apagados as (
      update public.participantes p set cpf = null, email = null, instituicao = null
       where p.cpf is not null or p.email is not null or p.instituicao is not null
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

  return jsonb_build_object('dados_pessoais', v_pessoais, 'participantes', v_participantes);
end $$;

-- pg_cron (diário): acorda a Edge Function `expurgo` só se houver algo vencido. Usa a mesma URL
-- base e o mesmo segredo de cron da fila de e-mail (Vault), sem configuração nova.
create function public.disparar_expurgo() returns bigint
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

revoke all on function public.expurgo_pdfs_pendentes(date) from public, anon, authenticated;
revoke all on function public.concluir_expurgo_pdfs(text[]) from public, anon, authenticated;
revoke all on function public.expurgar_dados(date) from public, anon, authenticated;
revoke all on function public.disparar_expurgo() from public, anon, authenticated;
grant execute on function public.expurgo_pdfs_pendentes(date) to service_role;
grant execute on function public.concluir_expurgo_pdfs(text[]) to service_role;
grant execute on function public.expurgar_dados(date) to service_role;

-- 03:50 de Maceió (06:50 UTC).
select cron.schedule('expurgo-lgpd', '50 6 * * *', $$select public.disparar_expurgo()$$);
