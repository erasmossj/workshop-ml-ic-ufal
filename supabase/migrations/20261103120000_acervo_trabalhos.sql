-- Acervo de trabalhos (WML-73 · ADR-007). Decisão da organização: manter, para uma futura página de
-- "edições passadas", SÓ os trabalhos APROVADOS (oral ou pôster) cujo autor deu autorização expressa
-- e separada (opt-in, desmarcado por padrão, revogável — LGPD art. 8º, §§ 4º e 5º).
--
-- Desenho: tabela própria `acervo_trabalhos`, sem CPF, e-mail, nome do inscrito, nº de inscrição ou
-- chave estrangeira para participantes/trabalhos. Ela é alimentada pelo expurgo de PDFs
-- (expurgar_dados, depois de config_evento.expurgo_pdfs = 31/01/2027): o trabalho é copiado e o
-- caminho do PDF passa da inscrição para o acervo. Assim o expurgo de dados pessoais (2027) e o
-- final (2031, que apaga participantes e, em cascata, trabalhos) não tocam o acervo.
-- A ligação inscrição → acervo fica do lado da inscrição (trabalhos.acervo_id), só para a
-- organização revogar pelo nº de inscrição enquanto ele existir; some junto com a inscrição.
--
-- Quem não autorizou ou não foi aprovado: nada muda — PDF apagado em 31/01/2027.
-- Revogação: antes de 31/01/2027 só desmarca; depois, admin_definir_acervo(nº, false) — ou, sem
-- nº (após 2031), admin_retirar_do_acervo(id) — apaga título/autores/resumo do acervo na hora e põe
-- o PDF na fila `pdfs_a_apagar`, que a Edge Function `expurgo` esvazia na rodada seguinte.
-- Assinatura de register_participant NÃO muda (o opt-in vem em p_trabalho->>'acervo').

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table public.acervo_trabalhos (
  id uuid primary key default gen_random_uuid(),
  edicao smallint not null check (edicao between 2026 and 2100),
  titulo text not null check (char_length(titulo) between 3 and 250),
  autores text not null check (char_length(autores) between 3 and 600),
  resumo text not null check (char_length(resumo) between 10 and 1500),
  status public.status_trabalho not null check (status in ('aprovado_oral', 'aprovado_poster')),
  pdf_path text unique,
  incluido_em timestamptz not null default now()
);

-- PDFs retirados do acervo, à espera da Edge Function `expurgo` (só o caminho UUID, sem dado pessoal).
create table public.pdfs_a_apagar (
  caminho text primary key,
  desde timestamptz not null default now()
);

-- Ano da edição gravado no acervo (a próxima edição só muda este valor).
alter table public.config_evento add column edicao smallint not null default 2026 check (edicao between 2026 and 2100);

alter table public.trabalhos
  add column acervo boolean not null default false,
  add column acervo_em timestamptz, -- quando autorizou ou revogou
  add column acervo_id uuid unique references public.acervo_trabalhos (id) on delete set null;

-- RLS deny-by-default: nenhuma policy. A página pública de edições passadas é feature futura.
alter table public.acervo_trabalhos enable row level security;
alter table public.pdfs_a_apagar enable row level security;
revoke all on public.acervo_trabalhos from anon, authenticated;
revoke all on public.pdfs_a_apagar from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Inscrição (ADR-003): igual à WML-72, mais o opt-in do acervo dentro de p_trabalho
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
-- Painel: listagem com a autorização do acervo (CPF continua mascarado)
-- ---------------------------------------------------------------------------

drop function public.admin_listar_inscricoes();

create function public.admin_listar_inscricoes()
returns table (
  numero text, nome text, email text, cpf_mascarado text, instituicao text,
  minicurso boolean, apresenta_trabalho boolean, titulo_trabalho text, status_trabalho text,
  concorre_premio boolean, nivel text, criada_em timestamptz, cancelada boolean,
  pdf_path text, email_status text, dias_presente date[], dias_minicurso date[],
  vinculo text, curso text, perfil_url text, vinculo_outro text, acervo boolean
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
         p.vinculo::text, p.curso, p.perfil_url, p.vinculo_outro, coalesce(t.acervo, false)
    from public.participantes p
    left join public.trabalhos t on t.participante_id = p.id
   order by p.criada_em;
end $$;

-- ---------------------------------------------------------------------------
-- Autorização / revogação registrada pela organização
-- ---------------------------------------------------------------------------

-- Tira um trabalho do acervo: título, autores e resumo saem na hora; o PDF vai para a fila do
-- expurgo (só a Edge Function apaga arquivo do Storage). Interna: as RPCs abaixo checam a organização.
create function public.retirar_do_acervo(p_id uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_pdf text;
begin
  delete from public.acervo_trabalhos a where a.id = p_id returning a.pdf_path into v_pdf;
  if not found then
    return false;
  end if;
  if v_pdf is not null then
    insert into public.pdfs_a_apagar (caminho) values (v_pdf) on conflict do nothing;
  end if;
  return true;
end $$;

-- Para quem autorizou ou revogou por e-mail (inclusive quem se inscreveu antes do opt-in).
create function public.admin_definir_acervo(p_numero text, p_acervo boolean) returns void
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
    -- Depois do expurgo de 31/01/2027 o PDF de quem não autorizou já não existe.
    if v_t.acervo_id is null and v_t.pdf_path is null then
      raise exception 'TRABALHO_SEM_PDF';
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

-- Depois do expurgo final (2031) não há mais nº de inscrição: a retirada é pelo id do acervo.
create function public.admin_retirar_do_acervo(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.pode_administrar() then
    raise exception 'NAO_AUTORIZADO';
  end if;
  update public.trabalhos t set acervo = false, acervo_em = now() where t.acervo_id = p_id;
  if not public.retirar_do_acervo(p_id) then
    raise exception 'ACERVO_INEXISTENTE';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Expurgo (WML-52): PDFs do acervo ficam; os demais saem em 31/01/2027
-- ---------------------------------------------------------------------------

-- PDFs a apagar: vencidos fora do acervo (não aprovados, sem autorização ou cancelados) e os
-- retirados do acervo (fila, sem data). Os aprovados e autorizados são transferidos por
-- expurgar_dados na mesma execução da Edge Function.
create or replace function public.expurgo_pdfs_pendentes(
  p_hoje date default (now() at time zone 'America/Maceio')::date
) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(x.caminho order by x.caminho), '{}')
    from (
      select t.pdf_path as caminho
        from public.trabalhos t
        join public.participantes p on p.id = t.participante_id
        cross join public.config_evento c
       where c.id and p_hoje > c.expurgo_pdfs and t.pdf_path is not null
         and not (t.acervo and t.status in ('aprovado_oral', 'aprovado_poster') and p.cancelada_em is null)
      union
      select f.caminho from public.pdfs_a_apagar f
    ) x
$$;

create or replace function public.concluir_expurgo_pdfs(p_caminhos text[]) returns integer
language sql security definer set search_path = '' as $$
  with limpos as (
    update public.trabalhos t set pdf_path = null
     where t.pdf_path = any (p_caminhos)
    returning t.pdf_path
  ), fila as (
    delete from public.pdfs_a_apagar f
     where f.caminho = any (p_caminhos)
    returning f.caminho
  )
  -- Um caminho nunca está nos dois lugares: ao entrar no acervo ele sai de trabalhos.
  select ((select count(*) from limpos) + (select count(*) from fila))::integer
$$;

-- Igual à WML-72 (vinculo_outro sai com os dados pessoais), mais a transferência para o acervo
-- depois do prazo dos PDFs — sempre ANTES do expurgo final, que apaga as inscrições.
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
         and t.acervo_id is null and t.pdf_path is not null
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

-- pg_cron (diário): acorda a Edge Function `expurgo` só se houver algo a fazer — agora também
-- quando há PDF retirado do acervo na fila.
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
    -- inclui os aprovados e autorizados ainda não transferidos para o acervo
    (v_hoje > v_config.expurgo_pdfs and exists (select 1 from public.trabalhos t where t.pdf_path is not null))
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

-- ---------------------------------------------------------------------------
-- Privilégios (explícitos, além dos default privileges)
-- ---------------------------------------------------------------------------

revoke all on function public.retirar_do_acervo(uuid) from public, anon, authenticated;
revoke all on function public.admin_definir_acervo(text, boolean) from public, anon;
revoke all on function public.admin_retirar_do_acervo(uuid) from public, anon;
revoke all on function public.admin_listar_inscricoes() from public, anon;
revoke all on function public.register_participant(text, text, text, text, smallint[], jsonb, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.expurgo_pdfs_pendentes(date) from public, anon, authenticated;
revoke all on function public.concluir_expurgo_pdfs(text[]) from public, anon, authenticated;
revoke all on function public.expurgar_dados(date) from public, anon, authenticated;
revoke all on function public.disparar_expurgo() from public, anon, authenticated;

grant execute on function public.admin_definir_acervo(text, boolean) to authenticated, service_role;
grant execute on function public.admin_retirar_do_acervo(uuid) to authenticated, service_role;
grant execute on function public.admin_listar_inscricoes() to authenticated, service_role;
grant execute on function public.register_participant(text, text, text, text, smallint[], jsonb, text, text, text, text)
  to service_role;
grant execute on function public.expurgo_pdfs_pendentes(date) to service_role;
grant execute on function public.concluir_expurgo_pdfs(text[]) to service_role;
grant execute on function public.expurgar_dados(date) to service_role;
