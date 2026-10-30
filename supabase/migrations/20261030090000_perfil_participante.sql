-- Vínculo, curso e perfil LinkedIn/Lattes na inscrição (WML-69), para o crachá (WML-70).
-- O perfil vira QR impresso: só LinkedIn (/in/) e Lattes (16 dígitos), normalizados em https.
-- Os parâmetros novos entram no FIM das RPCs, com default null: chamadas antigas continuam
-- válidas (aplicar a migration antes da Edge Function não derruba a inscrição). A obrigatoriedade
-- do vínculo fica na Edge Function `register`, a única que pode chamar register_participant().
-- O controle de vagas (ADR-003) não muda: o corpo da RPC é o mesmo, mais os três campos.

create type public.vinculo_participante as enum ('graduacao', 'mestrado', 'outro');

alter table public.participantes
  add column vinculo public.vinculo_participante,
  add column curso text check (char_length(curso) <= 120),
  add column perfil_url text check (
    perfil_url ~ '^https://(www\.linkedin\.com/in/[A-Za-z0-9_%-]{3,100}|lattes\.cnpq\.br/[0-9]{16})$'
  );

-- Mesmas regras de normalizarPerfil() (src/lib/validacao.ts). '' ou null = sem perfil.
create function public.normalizar_perfil(p_url text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  v text := btrim(coalesce(p_url, ''));
  m text[];
begin
  if v = '' then
    return null;
  end if;
  v := regexp_replace(v, '^https?://', '', 'i');
  v := regexp_replace(v, '[?#].*$', '');
  v := regexp_replace(v, '/+$', '');
  m := regexp_match(v, '^(?:[a-z]{2,3}\.|www\.)?linkedin\.com/in/([A-Za-z0-9_%-]{3,100})$', 'i');
  if m is not null then
    return 'https://www.linkedin.com/in/' || m[1];
  end if;
  m := regexp_match(v, '^(?:www\.)?lattes\.cnpq\.br/([0-9]{16})$', 'i');
  if m is not null then
    return 'https://lattes.cnpq.br/' || m[1];
  end if;
  raise exception 'PERFIL_INVALIDO';
end $$;

-- ---------------------------------------------------------------------------
-- Inscrição (ADR-003) + vínculo, curso e perfil
-- ---------------------------------------------------------------------------

drop function public.register_participant(text, text, text, text, smallint[], jsonb);
create function public.register_participant(
  p_nome text,
  p_cpf text,
  p_email text,
  p_instituicao text,
  p_minicursos smallint[],
  p_trabalho jsonb,
  p_vinculo text default null,
  p_curso text default null,
  p_perfil text default null
) returns table (id_inscricao uuid, numero_inscricao text)
language plpgsql security definer set search_path = '' as $$
declare
  cfg public.config_evento;
  v_nome text := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_inst text := nullif(btrim(coalesce(p_instituicao, '')), '');
  v_vinculo public.vinculo_participante;
  v_curso text := nullif(regexp_replace(btrim(coalesce(p_curso, '')), '\s+', ' ', 'g'), '');
  v_perfil text;
  v_id uuid;
  v_numero text;
  v_mc smallint;
  v_vagas integer;
begin
  select * into cfg from public.config_evento c where c.id;
  if not found or now() not between cfg.inscricoes_inicio and cfg.inscricoes_fim then
    raise exception 'INSCRICOES_FECHADAS';
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
  if p_vinculo is not null then
    begin
      v_vinculo := p_vinculo::public.vinculo_participante;
    exception when invalid_text_representation then
      raise exception 'VINCULO_INVALIDO';
    end;
  end if;
  if char_length(v_curso) > 120 then
    raise exception 'CURSO_INVALIDO';
  end if;
  v_perfil := public.normalizar_perfil(p_perfil);

  begin
    insert into public.participantes (nome, cpf, email, instituicao, vinculo, curso, perfil_url)
    values (v_nome, v_cpf, v_email, v_inst, v_vinculo, v_curso, v_perfil)
    returning participantes.id, participantes.numero into v_id, v_numero;
  exception when unique_violation then
    raise exception 'EMAIL_JA_INSCRITO';
  end;

  foreach v_mc in array (select coalesce(array_agg(distinct x), '{}') from unnest(p_minicursos) x) loop
    select m.vagas into v_vagas from public.minicursos m where m.id = v_mc;
    if not found then
      raise exception 'MINICURSO_INEXISTENTE';
    end if;
    if v_vagas is null then
      raise exception 'MINICURSO_FECHADO';
    end if;
    -- Atômico: em concorrência, o segundo UPDATE reavalia a condição após o commit do primeiro.
    update public.minicursos m set ocupadas = m.ocupadas + 1
     where m.id = v_mc and m.ocupadas < m.vagas;
    if not found then
      raise exception 'MINICURSO_ESGOTADO';
    end if;
    begin
      insert into public.inscricoes_minicurso (participante_id, minicurso_id, cpf)
      values (v_id, v_mc, v_cpf);
    exception when unique_violation then
      raise exception 'CPF_JA_NO_MINICURSO';
    end;
  end loop;

  if p_trabalho is not null then
    if now() not between cfg.submissoes_inicio and cfg.submissoes_fim then
      raise exception 'SUBMISSOES_FECHADAS';
    end if;
    if coalesce((p_trabalho ->> 'premio')::boolean, false)
       and nullif(p_trabalho ->> 'nivel', '') is null then
      raise exception 'NIVEL_OBRIGATORIO';
    end if;
    begin
      insert into public.trabalhos (participante_id, titulo, autores, resumo, premio, nivel)
      values (
        v_id,
        btrim(p_trabalho ->> 'titulo'),
        btrim(p_trabalho ->> 'autores'),
        btrim(p_trabalho ->> 'resumo'),
        coalesce((p_trabalho ->> 'premio')::boolean, false),
        nullif(p_trabalho ->> 'nivel', '')::public.nivel_premio
      );
    exception when check_violation or not_null_violation or invalid_text_representation then
      raise exception 'TRABALHO_INVALIDO';
    end;
  end if;

  insert into public.email_outbox (participante_id, tipo) values (v_id, 'confirmacao');

  id_inscricao := v_id;
  numero_inscricao := v_numero;
  return next;
end $$;

-- ---------------------------------------------------------------------------
-- Painel: listagem com vínculo, curso e perfil (CPF continua mascarado)
-- ---------------------------------------------------------------------------

drop function public.admin_listar_inscricoes();
create function public.admin_listar_inscricoes()
returns table (
  numero text, nome text, email text, cpf_mascarado text, instituicao text,
  minicurso boolean, apresenta_trabalho boolean, titulo_trabalho text, status_trabalho text,
  concorre_premio boolean, nivel text, criada_em timestamptz, cancelada boolean,
  pdf_path text, email_status text, dias_presente date[], dias_minicurso date[],
  vinculo text, curso text, perfil_url text
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
           order by o.id desc limit 1),
         coalesce((select array_agg(pr.dia order by pr.dia) from public.presencas pr
                    where pr.participante_id = p.id and pr.minicurso_id is null), '{}'),
         coalesce((select array_agg(pr.dia order by pr.dia) from public.presencas pr
                    where pr.participante_id = p.id and pr.minicurso_id is not null), '{}'),
         p.vinculo::text, p.curso, p.perfil_url
    from public.participantes p
    left join public.trabalhos t on t.participante_id = p.id
   order by p.criada_em;
end $$;

-- Correção pela organização. Campos novos: null mantém o valor atual; '' apaga.
drop function public.admin_corrigir_inscricao(text, text, text, text, text);
create function public.admin_corrigir_inscricao(
  p_numero text, p_nome text, p_email text, p_cpf text, p_instituicao text,
  p_vinculo text default null, p_curso text default null, p_perfil text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_nome text := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_inst text := nullif(btrim(coalesce(p_instituicao, '')), '');
  v_vinculo public.vinculo_participante;
  v_curso text := nullif(regexp_replace(btrim(coalesce(p_curso, '')), '\s+', ' ', 'g'), '');
  v_perfil text;
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
  if p_vinculo is not null then
    begin
      v_vinculo := p_vinculo::public.vinculo_participante;
    exception when invalid_text_representation then
      raise exception 'VINCULO_INVALIDO';
    end;
  end if;
  if char_length(v_curso) > 120 then
    raise exception 'CURSO_INVALIDO';
  end if;
  if p_perfil is not null then
    v_perfil := public.normalizar_perfil(p_perfil);
  end if;

  begin
    update public.participantes p
       set nome = v_nome, email = v_email, cpf = v_cpf, instituicao = v_inst,
           vinculo = coalesce(v_vinculo, p.vinculo),
           curso = case when p_curso is null then p.curso else v_curso end,
           perfil_url = case when p_perfil is null then p.perfil_url else v_perfil end
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

-- ---------------------------------------------------------------------------
-- Expurgo LGPD: curso e perfil saem junto com CPF, e-mail e instituição
-- ---------------------------------------------------------------------------

create or replace function public.expurgar_dados(
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
      update public.participantes p
         set cpf = null, email = null, instituicao = null, curso = null, perfil_url = null
       where p.cpf is not null or p.email is not null or p.instituicao is not null
          or p.curso is not null or p.perfil_url is not null
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

-- ---------------------------------------------------------------------------
-- Privilégios (explícitos, além dos default privileges)
-- ---------------------------------------------------------------------------

revoke all on function public.normalizar_perfil(text) from public, anon, authenticated;
revoke all on function public.register_participant(text, text, text, text, smallint[], jsonb, text, text, text)
  from public, anon, authenticated;
revoke all on function public.admin_listar_inscricoes() from public, anon;
revoke all on function public.admin_corrigir_inscricao(text, text, text, text, text, text, text, text)
  from public, anon;

grant execute on function public.register_participant(text, text, text, text, smallint[], jsonb, text, text, text)
  to service_role;
grant execute on function public.admin_listar_inscricoes() to authenticated, service_role;
grant execute on function public.admin_corrigir_inscricao(text, text, text, text, text, text, text, text)
  to authenticated, service_role;
