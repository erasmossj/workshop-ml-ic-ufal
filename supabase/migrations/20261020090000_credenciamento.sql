-- Credenciamento por QR (WML-54/56 · ADR-004).
-- Scan no modo Dia = presença em todas as palestras daquele dia; modo Minicurso = presença naquela
-- tarde do minicurso, só para inscritos nele. Repetir o scan não duplica (unicidade no banco).
-- check_in() só roda no servidor: a Edge Function `check-in` verifica o QR (HMAC) e o login do
-- organizador antes de chamar. Mesmo assim, a função confere que o operador é organizador.

-- Dias do evento aceitos no check-in (mesmas datas de `dias` em src/data/evento.ts).
alter table public.config_evento
  add column dias_evento date[] not null default '{2026-12-02,2026-12-03,2026-12-04}'
    check (cardinality(dias_evento) > 0);

create table public.presencas (
  id bigint generated always as identity primary key,
  participante_id uuid not null references public.participantes (id) on delete cascade,
  dia date not null,
  minicurso_id smallint references public.minicursos (id), -- null = presença do dia (palestras)
  origem text not null check (origem in ('qr', 'manual')),
  operador text not null check (char_length(operador) <= 254),
  registrada_em timestamptz not null default now(),
  constraint presenca_unica unique nulls not distinct (participante_id, dia, minicurso_id)
);
create index presencas_dia_idx on public.presencas (dia, minicurso_id);

alter table public.presencas enable row level security;
revoke all on public.presencas from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Check-in (servidor)
-- ---------------------------------------------------------------------------

-- Resultado: ok | ja_registrado | nao_inscrito_minicurso | cancelada | inexistente
--            | dia_invalido | minicurso_invalido. O nome volta só para o operador conferir.
create function public.check_in(
  p_numero text, p_dia date, p_minicurso text, p_origem text, p_operador text
) returns table (resultado text, numero text, nome text)
language plpgsql security definer set search_path = '' as $$
declare
  v_operador text := lower(btrim(coalesce(p_operador, '')));
  v_minicurso smallint;
  v_id uuid;
  v_numero text;
  v_nome text;
  v_cancelada timestamptz;
  v_linhas integer;
begin
  if not exists (select 1 from public.organizadores o where o.email = v_operador) then
    raise exception 'NAO_AUTORIZADO';
  end if;
  if p_origem is null or p_origem not in ('qr', 'manual') then
    raise exception 'ORIGEM_INVALIDA';
  end if;

  if p_dia is null or not exists (
    select 1 from public.config_evento c where c.id and p_dia = any (c.dias_evento)
  ) then
    return query select 'dia_invalido'::text, null::text, null::text;
    return;
  end if;

  if p_minicurso is not null then
    select m.id into v_minicurso from public.minicursos m where m.slug = p_minicurso;
    if v_minicurso is null then
      return query select 'minicurso_invalido'::text, null::text, null::text;
      return;
    end if;
  end if;

  select p.id, p.numero, p.nome, p.cancelada_em into v_id, v_numero, v_nome, v_cancelada
    from public.participantes p
   where p.numero = upper(btrim(coalesce(p_numero, '')));
  if v_id is null then
    return query select 'inexistente'::text, null::text, null::text;
    return;
  end if;
  if v_cancelada is not null then
    return query select 'cancelada'::text, v_numero, v_nome;
    return;
  end if;
  if v_minicurso is not null and not exists (
    select 1 from public.inscricoes_minicurso i
     where i.participante_id = v_id and i.minicurso_id = v_minicurso
  ) then
    return query select 'nao_inscrito_minicurso'::text, v_numero, v_nome;
    return;
  end if;

  insert into public.presencas (participante_id, dia, minicurso_id, origem, operador)
  values (v_id, p_dia, v_minicurso, p_origem, v_operador)
  on conflict on constraint presenca_unica do nothing;
  get diagnostics v_linhas = row_count;

  return query select (case when v_linhas = 1 then 'ok' else 'ja_registrado' end)::text, v_numero, v_nome;
end $$;

-- ---------------------------------------------------------------------------
-- Painel (WML-56)
-- ---------------------------------------------------------------------------

-- Contagens por dia e por tarde de minicurso (sem dado pessoal).
create function public.admin_resumo_presencas() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.pode_administrar() then
    raise exception 'NAO_AUTORIZADO';
  end if;
  return jsonb_build_object(
    'dias', coalesce((
      select jsonb_agg(jsonb_build_object(
               'dia', d.dia,
               'presentes', (select count(*) from public.presencas p
                              where p.dia = d.dia and p.minicurso_id is null))
             order by d.dia)
        from public.config_evento c, unnest(c.dias_evento) as d (dia)
       where c.id), '[]'::jsonb),
    'minicursos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'slug', m.slug,
               'titulo', m.titulo,
               'dia', d.dia,
               'inscritos', (select count(*) from public.inscricoes_minicurso i where i.minicurso_id = m.id),
               'presentes', (select count(*) from public.presencas p
                              where p.dia = d.dia and p.minicurso_id = m.id))
             order by m.id, d.dia)
        from public.minicursos m
        cross join public.config_evento c
        cross join unnest(c.dias_evento) as d (dia)
       where c.id), '[]'::jsonb)
  );
end $$;

-- Listagem do painel: + dias com presença (palestras) e tardes de minicurso com presença.
drop function public.admin_listar_inscricoes();
create function public.admin_listar_inscricoes()
returns table (
  numero text, nome text, email text, cpf_mascarado text, instituicao text,
  minicurso boolean, apresenta_trabalho boolean, titulo_trabalho text, status_trabalho text,
  concorre_premio boolean, nivel text, criada_em timestamptz, cancelada boolean,
  pdf_path text, email_status text, dias_presente date[], dias_minicurso date[]
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
                    where pr.participante_id = p.id and pr.minicurso_id is not null), '{}')
    from public.participantes p
    left join public.trabalhos t on t.participante_id = p.id
   order by p.criada_em;
end $$;

revoke all on function public.check_in(text, date, text, text, text) from public, anon, authenticated;
revoke all on function public.admin_resumo_presencas() from public, anon;
revoke all on function public.admin_listar_inscricoes() from public, anon;

grant execute on function public.check_in(text, date, text, text, text) to service_role;
grant execute on function public.admin_resumo_presencas() to authenticated, service_role;
grant execute on function public.admin_listar_inscricoes() to authenticated, service_role;
