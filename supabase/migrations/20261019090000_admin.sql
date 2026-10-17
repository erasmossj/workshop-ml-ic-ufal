-- Painel da organização (WML-32..35). Toda RPC verifica public.pode_administrar() (organizadores
-- via auth.jwt()). CPF só sai mascarado. Vagas só mudam por cancel_registration/admin_definir_vagas.

-- PDFs dos trabalhos: o organizador lê o objeto (para gerar URL assinada curta) — ninguém mais.
grant execute on function public.pode_administrar() to authenticated;
create policy "organizadores leem trabalhos" on storage.objects
  for select to authenticated
  using (bucket_id = 'trabalhos' and public.pode_administrar());

-- Listagem: + caminho do PDF e situação do último e-mail de confirmação.
drop function public.admin_listar_inscricoes();
create function public.admin_listar_inscricoes()
returns table (
  numero text, nome text, email text, cpf_mascarado text, instituicao text,
  minicurso boolean, apresenta_trabalho boolean, titulo_trabalho text, status_trabalho text,
  concorre_premio boolean, nivel text, criada_em timestamptz, cancelada boolean,
  pdf_path text, email_status text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.pode_administrar() then
    raise exception 'NAO_AUTORIZADO';
  end if;
  return query
  select p.numero, p.nome, p.email, public.mascarar_cpf(p.cpf), p.instituicao,
         exists (select 1 from public.inscricoes_minicurso i where i.participante_id = p.id),
         t.id is not null, t.titulo, t.status::text, coalesce(t.premio, false), t.nivel::text,
         p.criada_em, p.cancelada_em is not null, t.pdf_path,
         (select o.status from public.email_outbox o
           where o.participante_id = p.id and o.tipo = 'confirmacao'
           order by o.id desc limit 1)
    from public.participantes p
    left join public.trabalhos t on t.participante_id = p.id
   order by p.criada_em;
end $$;

create function public.participante_por_numero(p_numero text) returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  select p.id into v_id from public.participantes p where p.numero = btrim(p_numero);
  if v_id is null then
    raise exception 'INSCRICAO_INEXISTENTE';
  end if;
  return v_id;
end $$;

-- Cancela pelo número de inscrição (libera as vagas em cancel_registration, na mesma transação).
create function public.admin_cancelar_inscricao(p_numero text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_administrar() then
    raise exception 'NAO_AUTORIZADO';
  end if;
  perform public.cancel_registration(public.participante_por_numero(p_numero));
end $$;

-- Corrige dados digitados errado (mesmas validações da inscrição).
create function public.admin_corrigir_inscricao(
  p_numero text, p_nome text, p_email text, p_cpf text, p_instituicao text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_nome text := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_inst text := nullif(btrim(coalesce(p_instituicao, '')), '');
begin
  if not public.pode_administrar() then
    raise exception 'NAO_AUTORIZADO';
  end if;
  v_id := public.participante_por_numero(p_numero);
  if exists (select 1 from public.participantes p where p.id = v_id and p.cancelada_em is not null) then
    raise exception 'INSCRICAO_CANCELADA';
  end if;
  if position(' ' in v_nome) = 0 or char_length(v_nome) > 120
     or v_nome ~ '[0-9<>{}\[\]\\/@#$%&*=+_|^~`"!?;:]' then
    raise exception 'NOME_INVALIDO';
  end if;
  if not public.cpf_valido(v_cpf) then
    raise exception 'CPF_INVALIDO';
  end if;
  if char_length(v_email) > 254 or v_email !~ '^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$' then
    raise exception 'EMAIL_INVALIDO';
  end if;
  if char_length(v_inst) > 160 then
    raise exception 'INSTITUICAO_INVALIDA';
  end if;

  begin
    update public.participantes p
       set nome = v_nome, email = v_email, cpf = v_cpf, instituicao = v_inst
     where p.id = v_id;
  exception when unique_violation then
    raise exception 'EMAIL_JA_INSCRITO';
  end;
  begin
    update public.inscricoes_minicurso i set cpf = v_cpf where i.participante_id = v_id;
  exception when unique_violation then
    raise exception 'CPF_JA_NO_MINICURSO';
  end;
end $$;

-- Põe um novo e-mail de confirmação na fila (ex.: e-mail corrigido ou envio que falhou).
create function public.admin_reenviar_confirmacao(p_numero text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not public.pode_administrar() then
    raise exception 'NAO_AUTORIZADO';
  end if;
  v_id := public.participante_por_numero(p_numero);
  if exists (select 1 from public.participantes p where p.id = v_id and p.cancelada_em is not null) then
    raise exception 'INSCRICAO_CANCELADA';
  end if;
  if not exists (
    select 1 from public.email_outbox o
     where o.participante_id = v_id and o.tipo = 'confirmacao' and o.status in ('pendente', 'enviando')
  ) then
    insert into public.email_outbox (participante_id, tipo) values (v_id, 'confirmacao');
  end if;
end $$;

create function public.admin_obter_config() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.pode_administrar() then
    raise exception 'NAO_AUTORIZADO';
  end if;
  return (
    select jsonb_build_object(
      'inscricoes_inicio', c.inscricoes_inicio,
      'inscricoes_fim', c.inscricoes_fim,
      'submissoes_inicio', c.submissoes_inicio,
      'submissoes_fim', c.submissoes_fim,
      'limite_diario_email', c.limite_diario_email,
      'minicursos', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', m.id, 'slug', m.slug, 'titulo', m.titulo, 'vagas', m.vagas, 'ocupadas', m.ocupadas)
               order by m.id)
          from public.minicursos m), '[]'::jsonb)
    )
    from public.config_evento c
   where c.id
  );
end $$;

-- Janelas de inscrição/submissão (ex.: prorrogação até 18/11) e teto diário de e-mail.
create function public.admin_definir_janelas(
  p_inscricoes_inicio timestamptz, p_inscricoes_fim timestamptz,
  p_submissoes_inicio timestamptz, p_submissoes_fim timestamptz,
  p_limite_diario_email integer
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_administrar() then
    raise exception 'NAO_AUTORIZADO';
  end if;
  update public.config_evento c
     set inscricoes_inicio = p_inscricoes_inicio, inscricoes_fim = p_inscricoes_fim,
         submissoes_inicio = p_submissoes_inicio, submissoes_fim = p_submissoes_fim,
         limite_diario_email = p_limite_diario_email
   where c.id;
exception
  when check_violation or not_null_violation then
    raise exception 'JANELAS_INVALIDAS';
end $$;

-- Situação da fila de e-mail (contagens, sem dado pessoal).
create function public.admin_resumo_emails() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_inicio_dia timestamptz :=
    date_trunc('day', now() at time zone 'America/Maceio') at time zone 'America/Maceio';
begin
  if not public.pode_administrar() then
    raise exception 'NAO_AUTORIZADO';
  end if;
  return jsonb_build_object(
    'pendente', (select count(*) from public.email_outbox o where o.status = 'pendente'),
    'enviando', (select count(*) from public.email_outbox o where o.status = 'enviando'),
    'enviado', (select count(*) from public.email_outbox o where o.status = 'enviado'),
    'falhou', (select count(*) from public.email_outbox o where o.status = 'falhou'),
    'enviados_hoje', (select count(*) from public.email_outbox o
                       where o.status = 'enviado' and o.enviado_em >= v_inicio_dia),
    'limite_diario', (select c.limite_diario_email from public.config_evento c where c.id)
  );
end $$;

revoke all on function public.admin_listar_inscricoes() from public, anon;
revoke all on function public.participante_por_numero(text) from public, anon, authenticated;
revoke all on function public.admin_cancelar_inscricao(text) from public, anon;
revoke all on function public.admin_corrigir_inscricao(text, text, text, text, text) from public, anon;
revoke all on function public.admin_reenviar_confirmacao(text) from public, anon;
revoke all on function public.admin_obter_config() from public, anon;
revoke all on function public.admin_definir_janelas(timestamptz, timestamptz, timestamptz, timestamptz, integer) from public, anon;
revoke all on function public.admin_resumo_emails() from public, anon;

grant execute on function public.admin_listar_inscricoes() to authenticated, service_role;
grant execute on function public.admin_cancelar_inscricao(text) to authenticated, service_role;
grant execute on function public.admin_corrigir_inscricao(text, text, text, text, text) to authenticated, service_role;
grant execute on function public.admin_reenviar_confirmacao(text) to authenticated, service_role;
grant execute on function public.admin_obter_config() to authenticated, service_role;
grant execute on function public.admin_definir_janelas(timestamptz, timestamptz, timestamptz, timestamptz, integer) to authenticated, service_role;
grant execute on function public.admin_resumo_emails() to authenticated, service_role;
