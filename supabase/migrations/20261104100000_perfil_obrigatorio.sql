-- Perfil LinkedIn/Lattes obrigatório na inscrição (WML-78). Até aqui era opcional (WML-69).
-- Vale para todos os vínculos (estudante, docente, outro) e só aceita LinkedIn (/in/) ou Lattes,
-- com as mesmas regras de public.normalizar_perfil() (inalterada).
--
-- Inscrições antigas sem perfil continuam válidas: a coluna participantes.perfil_url SEGUE
-- aceitando null (sem NOT NULL) — a regra mora nas RPCs, por onde passa toda escrita nova.
--  * register_participant: perfil vazio/ausente → PERFIL_OBRIGATORIO (antes gravava null).
--  * admin_corrigir_inscricao: null continua mantendo o valor atual (inclusive o null de uma
--    inscrição antiga); '' (apagar o perfil) passa a ser recusado com PERFIL_OBRIGATORIO.
-- Assinaturas não mudam: create or replace preserva os privilégios, repetidos abaixo por clareza.

-- ---------------------------------------------------------------------------
-- Inscrição (ADR-003): igual à WML-73, com o perfil obrigatório
-- ---------------------------------------------------------------------------

create or replace function public.register_participant(
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
  -- Perfil obrigatório (WML-78): vira o QR Code do crachá. Formato inválido → PERFIL_INVALIDO.
  v_perfil := public.normalizar_perfil(p_perfil);
  if v_perfil is null then
    raise exception 'PERFIL_OBRIGATORIO';
  end if;

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
      -- Acervo (WML-73): só com o opt-in explícito; ausente (Edge Function antiga) = não autorizou.
      insert into public.trabalhos
        (participante_id, titulo, autores, resumo, premio, nivel, acervo, acervo_em)
      select v_id,
             btrim(p_trabalho ->> 'titulo'),
             btrim(p_trabalho ->> 'autores'),
             btrim(p_trabalho ->> 'resumo'),
             coalesce((p_trabalho ->> 'premio')::boolean, false),
             nullif(p_trabalho ->> 'nivel', '')::public.nivel_premio,
             a.acervo,
             case when a.acervo then now() end
        from (select coalesce((p_trabalho ->> 'acervo')::boolean, false) as acervo) a;
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
-- Correção pela organização: igual à WML-72, sem apagar o perfil
-- ---------------------------------------------------------------------------

-- Campos opcionais: null mantém o valor atual; '' apaga (curso). Perfil: null mantém, '' é
-- recusado (PERFIL_OBRIGATORIO). Vínculo: null mantém vínculo e texto. Trocar para "outro" exige
-- texto; sair do "outro" apaga o texto.
create or replace function public.admin_corrigir_inscricao(
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
    if v_perfil is null then
      raise exception 'PERFIL_OBRIGATORIO';
    end if;
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
-- Privilégios (explícitos, além dos default privileges) — os mesmos de antes
-- ---------------------------------------------------------------------------

revoke all on function public.register_participant(text, text, text, text, smallint[], jsonb, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.admin_corrigir_inscricao(text, text, text, text, text, text, text, text, text)
  from public, anon;

grant execute on function public.register_participant(text, text, text, text, smallint[], jsonb, text, text, text, text)
  to service_role;
grant execute on function public.admin_corrigir_inscricao(text, text, text, text, text, text, text, text, text)
  to authenticated, service_role;
