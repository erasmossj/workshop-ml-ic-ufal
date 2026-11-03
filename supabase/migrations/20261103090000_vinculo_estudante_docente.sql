-- Vínculo passa a ser Estudante / Docente / Outro, com campo livre para o "Outro" (WML-72).
-- Substitui o enum da WML-69 ('graduacao', 'mestrado', 'outro'), que já tem inscrições reais.
--
-- Conversão dos dados: graduacao e mestrado → estudante; outro → outro. O Postgres não remove
-- valores de enum, então a coluna passa por text, o tipo antigo é removido e recriado com o mesmo
-- nome, e a conversão usa public.converter_vinculo() — a MESMA função que as RPCs usam para aceitar
-- os valores legados durante o deploy (página/Edge Function antiga ainda mandando graduacao/mestrado).
--
-- Texto do "Outro" (participantes.vinculo_outro): até 40 caracteres, sem espaços extras, e só pode
-- existir quando vinculo = 'outro'. Essa parte é constraint VALIDADA na coluna.
-- A obrigatoriedade (outro ⇒ texto) fica nas RPCs, as únicas portas de escrita, e NÃO na constraint:
-- inscrições da WML-69 com "outro" não têm texto. Uma constraint NOT VALID não serve, porque o
-- Postgres a confere em todo UPDATE da linha — cancelar a inscrição, corrigir o e-mail ou o expurgo
-- LGPD (que zera CPF/e-mail de todos) passariam a falhar nessas linhas antigas.
--
-- As RPCs ganham p_vinculo_outro no FIM, com default null: a Edge Function antiga continua chamando
-- register_participant() com os mesmos parâmetros nomeados. O controle de vagas (ADR-003) não muda.

-- ---------------------------------------------------------------------------
-- Tipo novo e conversão
-- ---------------------------------------------------------------------------

-- As RPCs antigas citam o tipo no corpo; saem antes da troca e voltam recriadas abaixo.
drop function public.register_participant(text, text, text, text, smallint[], jsonb, text, text, text);
drop function public.admin_corrigir_inscricao(text, text, text, text, text, text, text, text);
drop function public.admin_listar_inscricoes();

alter table public.participantes alter column vinculo type text using vinculo::text;
drop type public.vinculo_participante;
create type public.vinculo_participante as enum ('estudante', 'docente', 'outro');

-- Texto → vínculo. Aceita os valores legados da WML-69; null continua null; o resto é recusado.
create function public.converter_vinculo(p_vinculo text) returns public.vinculo_participante
language plpgsql immutable set search_path = '' as $$
begin
  if p_vinculo is null then
    return null;
  end if;
  return (case p_vinculo
            when 'graduacao' then 'estudante'
            when 'mestrado' then 'estudante'
            else p_vinculo
          end)::public.vinculo_participante;
exception when invalid_text_representation then
  raise exception 'VINCULO_INVALIDO';
end $$;

alter table public.participantes
  alter column vinculo type public.vinculo_participante using public.converter_vinculo(vinculo);

alter table public.participantes
  add column vinculo_outro text,
  add constraint participantes_vinculo_outro_check check (
    vinculo_outro is null
    or (vinculo is not distinct from 'outro'
        and char_length(vinculo_outro) between 1 and 40
        and vinculo_outro = regexp_replace(btrim(vinculo_outro), '\s+', ' ', 'g')
        and vinculo_outro !~ '[[:cntrl:]]')
  );

-- ---------------------------------------------------------------------------
-- Inscrição (ADR-003) + texto do "Outro"
-- ---------------------------------------------------------------------------

create function public.register_participant(
  p_nome text,
  p_cpf text,
  p_email text,
  p_instituicao text,
  p_minicursos smallint[],
  p_trabalho jsonb,
  p_vinculo text default null,
  p_curso text default null,
  p_perfil text default null,
  p_vinculo_outro text default null
) returns table (id_inscricao uuid, numero_inscricao text)
language plpgsql security definer set search_path = '' as $$
declare
  cfg public.config_evento;
  v_nome text := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_inst text := nullif(btrim(coalesce(p_instituicao, '')), '');
  v_vinculo public.vinculo_participante;
  v_outro text := nullif(regexp_replace(btrim(coalesce(p_vinculo_outro, '')), '\s+', ' ', 'g'), '');
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
  v_vinculo := public.converter_vinculo(p_vinculo);
  -- "Outro" exige o texto (até 40); estudante/docente não levam texto.
  if v_vinculo is not distinct from 'outro'
       and (v_outro is null or char_length(v_outro) > 40 or v_outro ~ '[[:cntrl:]]')
     or v_vinculo is distinct from 'outro' and v_outro is not null then
    raise exception 'VINCULO_OUTRO_INVALIDO';
  end if;
  if char_length(v_curso) > 120 then
    raise exception 'CURSO_INVALIDO';
  end if;
  v_perfil := public.normalizar_perfil(p_perfil);

  begin
    insert into public.participantes
      (nome, cpf, email, instituicao, vinculo, vinculo_outro, curso, perfil_url)
    values (v_nome, v_cpf, v_email, v_inst, v_vinculo, v_outro, v_curso, v_perfil)
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
-- Painel: listagem com o texto do "Outro" (CPF continua mascarado)
-- ---------------------------------------------------------------------------

create function public.admin_listar_inscricoes()
returns table (
  numero text, nome text, email text, cpf_mascarado text, instituicao text,
  minicurso boolean, apresenta_trabalho boolean, titulo_trabalho text, status_trabalho text,
  concorre_premio boolean, nivel text, criada_em timestamptz, cancelada boolean,
  pdf_path text, email_status text, dias_presente date[], dias_minicurso date[],
  vinculo text, curso text, perfil_url text, vinculo_outro text
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
         p.vinculo::text, p.curso, p.perfil_url, p.vinculo_outro
    from public.participantes p
    left join public.trabalhos t on t.participante_id = p.id
   order by p.criada_em;
end $$;

-- Correção pela organização. Campos opcionais: null mantém o valor atual; '' apaga.
-- Vínculo: null mantém vínculo e texto. Trocar para "outro" exige texto; sair do "outro" apaga o
-- texto. Inscrição antiga com "outro" e sem texto pode ser corrigida sem mexer no vínculo.
create function public.admin_corrigir_inscricao(
  p_numero text, p_nome text, p_email text, p_cpf text, p_instituicao text,
  p_vinculo text default null, p_curso text default null, p_perfil text default null,
  p_vinculo_outro text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_nome text := regexp_replace(btrim(coalesce(p_nome, '')), '\s+', ' ', 'g');
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_inst text := nullif(btrim(coalesce(p_instituicao, '')), '');
  v_vinculo public.vinculo_participante;
  v_outro text := nullif(regexp_replace(btrim(coalesce(p_vinculo_outro, '')), '\s+', ' ', 'g'), '');
  v_atual public.participantes;
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
  v_vinculo := public.converter_vinculo(p_vinculo);
  select * into v_atual from public.participantes p where p.id = v_id;
  if p_vinculo is null and p_vinculo_outro is null then
    -- Nada de vínculo na correção: mantém vínculo e texto como estão.
    v_vinculo := v_atual.vinculo;
    v_outro := v_atual.vinculo_outro;
  else
    v_vinculo := coalesce(v_vinculo, v_atual.vinculo);
    if v_vinculo is not distinct from 'outro'
         and (v_outro is null or char_length(v_outro) > 40 or v_outro ~ '[[:cntrl:]]')
       or v_vinculo is distinct from 'outro' and v_outro is not null then
      raise exception 'VINCULO_OUTRO_INVALIDO';
    end if;
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
           vinculo = v_vinculo, vinculo_outro = v_outro,
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
-- Expurgo LGPD: o texto livre do "Outro" sai junto com curso e perfil
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

  return jsonb_build_object('dados_pessoais', v_pessoais, 'participantes', v_participantes);
end $$;

-- ---------------------------------------------------------------------------
-- Privilégios (explícitos, além dos default privileges) — os mesmos da WML-69
-- ---------------------------------------------------------------------------

revoke all on function public.converter_vinculo(text) from public, anon, authenticated;
revoke all on function public.register_participant(text, text, text, text, smallint[], jsonb, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.admin_listar_inscricoes() from public, anon;
revoke all on function public.admin_corrigir_inscricao(text, text, text, text, text, text, text, text, text)
  from public, anon;

grant execute on function public.register_participant(text, text, text, text, smallint[], jsonb, text, text, text, text)
  to service_role;
grant execute on function public.admin_listar_inscricoes() to authenticated, service_role;
grant execute on function public.admin_corrigir_inscricao(text, text, text, text, text, text, text, text, text)
  to authenticated, service_role;
