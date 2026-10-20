-- Credenciamento (WML-54/56 · ADR-004): check-in idempotente, modos Dia e Minicurso, só servidor.
-- CPFs e e-mails sintéticos — nunca use dados reais.
begin;
select plan(31);

update public.config_evento
   set inscricoes_inicio = now() - interval '1 day', inscricoes_fim = now() + interval '1 day';
insert into public.minicursos (id, slug, titulo, vagas) values (94, 'teste-cred', 'Minicurso credenciamento', 5);
insert into public.organizadores (email) values ('org@exemplo.com');

create temp table insc as
  select 'ana' as quem, * from public.register_participant('Ana Cred', '529.982.247-25', 'ana.cred@exemplo.com', null, '{94}', null)
  union all
  select 'bia', * from public.register_participant('Bia Cred', '111.444.777-35', 'bia.cred@exemplo.com', null, '{}', null)
  union all
  select 'caio', * from public.register_participant('Caio Cred', '123.456.789-09', 'caio.cred@exemplo.com', null, '{94}', null);
set local request.jwt.claims = '{"role":"service_role"}';
select public.cancel_registration((select id_inscricao from insc where quem = 'caio'));
reset request.jwt.claims;

create function pg_temp.num(p_quem text) returns text language sql as $$
  select numero_inscricao from insc where quem = p_quem
$$;

-- estrutura e privilégios ------------------------------------------------------------
select has_table('public', 'presencas', 'tabela presencas existe');
select is((select rowsecurity from pg_tables where schemaname = 'public' and tablename = 'presencas'), true,
  'presencas nasce com RLS');
select ok(not has_function_privilege('anon', 'public.check_in(text,date,text,text,text)', 'execute'),
  'anon NÃO faz check-in');
select ok(not has_function_privilege('authenticated', 'public.check_in(text,date,text,text,text)', 'execute'),
  'authenticated NÃO chama check_in direto (só a Edge Function, que verifica o QR)');
select ok(has_function_privilege('service_role', 'public.check_in(text,date,text,text,text)', 'execute'),
  'service_role faz check-in');
select ok(not has_function_privilege('anon', 'public.admin_resumo_presencas()', 'execute'),
  'anon NÃO vê o resumo de presenças');

-- operador precisa ser organizador, mesmo vindo do servidor -------------------------
select throws_ok($$ select * from public.check_in(pg_temp.num('ana'), '2026-12-02', null, 'qr', 'intruso@exemplo.com') $$,
  'P0001', 'NAO_AUTORIZADO', 'operador fora da lista de organizadores é recusado');
select throws_ok($$ select * from public.check_in(pg_temp.num('ana'), '2026-12-02', null, 'bluetooth', 'org@exemplo.com') $$,
  'P0001', 'ORIGEM_INVALIDA', 'origem desconhecida é recusada');

-- modo Dia ---------------------------------------------------------------------------
select is((select resultado || '|' || nome from public.check_in(pg_temp.num('ana'), '2026-12-02', null, 'qr', 'ORG@exemplo.com')),
  'ok|Ana Cred', 'primeiro scan do dia registra presença e devolve o nome para conferência');
select is((select resultado from public.check_in(pg_temp.num('ana'), '2026-12-02', null, 'qr', 'org@exemplo.com')),
  'ja_registrado', 'repetir o scan não duplica');
select is((select count(*)::int from public.presencas p
            where p.participante_id = (select id_inscricao from insc where quem = 'ana') and p.dia = '2026-12-02'), 1,
  'só uma presença no dia, mesmo com dois scans');
select is((select operador || '|' || origem from public.presencas p
            where p.participante_id = (select id_inscricao from insc where quem = 'ana')), 'org@exemplo.com|qr',
  'guarda operador (normalizado) e origem');
select is((select resultado from public.check_in(lower(' ' || pg_temp.num('bia') || ' '), '2026-12-03', null, 'manual', 'org@exemplo.com')),
  'ok', 'busca manual aceita número com espaços e minúsculas');
select is((select resultado from public.check_in(pg_temp.num('ana'), '2026-12-05', null, 'qr', 'org@exemplo.com')),
  'dia_invalido', 'dia fora do evento é recusado');
select is((select resultado from public.check_in(pg_temp.num('ana'), null, null, 'qr', 'org@exemplo.com')),
  'dia_invalido', 'dia vazio é recusado');
select is((select resultado || '|' || coalesce(nome, '-') from public.check_in('ICML26-9999', '2026-12-02', null, 'qr', 'org@exemplo.com')),
  'inexistente|-', 'número inexistente não revela nada');
select is((select resultado || '|' || nome from public.check_in(pg_temp.num('caio'), '2026-12-02', null, 'qr', 'org@exemplo.com')),
  'cancelada|Caio Cred', 'inscrição cancelada não ganha presença');
select is((select count(*)::int from public.presencas p
            where p.participante_id = (select id_inscricao from insc where quem = 'caio')), 0,
  'nenhuma presença gravada para inscrição cancelada');

-- modo Minicurso ---------------------------------------------------------------------
select is((select resultado from public.check_in(pg_temp.num('ana'), '2026-12-02', 'teste-cred', 'qr', 'org@exemplo.com')),
  'ok', 'inscrita no minicurso ganha presença na tarde');
select is((select resultado from public.check_in(pg_temp.num('ana'), '2026-12-02', 'teste-cred', 'qr', 'org@exemplo.com')),
  'ja_registrado', 'repetir o scan do minicurso não duplica');
select is((select count(*)::int from public.presencas p
            where p.participante_id = (select id_inscricao from insc where quem = 'ana')), 2,
  'presença do dia e do minicurso são registros separados');
select is((select resultado || '|' || nome from public.check_in(pg_temp.num('bia'), '2026-12-02', 'teste-cred', 'qr', 'org@exemplo.com')),
  'nao_inscrito_minicurso|Bia Cred', 'quem não se inscreveu no minicurso é avisado');
select is((select resultado from public.check_in(pg_temp.num('ana'), '2026-12-02', 'nao-existe', 'qr', 'org@exemplo.com')),
  'minicurso_invalido', 'minicurso desconhecido é recusado');

-- painel: intruso recusado, organizador vê contagens e presenças na lista --------------
set local request.jwt.claims = '{"role":"authenticated","email":"intruso@exemplo.com"}';
select throws_ok('select public.admin_resumo_presencas()', 'P0001', 'NAO_AUTORIZADO',
  'intruso não vê o resumo de presenças');

set local request.jwt.claims = '{"role":"authenticated","email":"org@exemplo.com"}';
select is((select (d ->> 'presentes')::int from jsonb_array_elements(public.admin_resumo_presencas() -> 'dias') d
            where d ->> 'dia' = '2026-12-02'), 1, 'resumo conta presentes no dia 02/12');
select is((select (d ->> 'presentes')::int from jsonb_array_elements(public.admin_resumo_presencas() -> 'dias') d
            where d ->> 'dia' = '2026-12-03'), 1, 'resumo conta presentes no dia 03/12');
select is((select (d ->> 'presentes')::int from jsonb_array_elements(public.admin_resumo_presencas() -> 'dias') d
            where d ->> 'dia' = '2026-12-04'), 0, 'dia sem presença aparece com zero');
select is((select (m ->> 'presentes')::int from jsonb_array_elements(public.admin_resumo_presencas() -> 'minicursos') m
            where m ->> 'slug' = 'teste-cred' and m ->> 'dia' = '2026-12-02'), 1,
  'resumo conta presentes no minicurso por tarde');
select is((select (m ->> 'inscritos')::int from jsonb_array_elements(public.admin_resumo_presencas() -> 'minicursos') m
            where m ->> 'slug' = 'teste-cred' and m ->> 'dia' = '2026-12-02'), 1,
  'resumo traz os inscritos ativos do minicurso');
select is((select dias_presente::text from public.admin_listar_inscricoes() where email = 'ana.cred@exemplo.com'),
  '{2026-12-02}', 'lista do painel traz os dias com presença');
select is((select dias_minicurso::text from public.admin_listar_inscricoes() where email = 'ana.cred@exemplo.com'),
  '{2026-12-02}', 'lista do painel traz as tardes de minicurso com presença');

select * from finish();
rollback;
