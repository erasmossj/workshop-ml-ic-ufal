-- Fronteira de segurança do banco (threat model S1/S2). CPFs sintéticos.
begin;
select plan(18);

-- RLS e privilégios -----------------------------------------------------------
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity), 0,
  'RLS habilitado em todas as tabelas de public');
select is(
  (select count(*)::int from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('anon', 'authenticated')), 0,
  'anon/authenticated não têm nenhum privilégio direto em tabelas');
select ok(
  not has_function_privilege('anon', 'public.register_participant(text,text,text,text,smallint[],jsonb,text,text,text)', 'execute'),
  'anon NÃO executa register_participant (só via Edge Function)');
select ok(
  not has_function_privilege('authenticated', 'public.register_participant(text,text,text,text,smallint[],jsonb,text,text,text)', 'execute'),
  'authenticated NÃO executa register_participant');
select ok(
  has_function_privilege('service_role', 'public.register_participant(text,text,text,text,smallint[],jsonb,text,text,text)', 'execute'),
  'service_role executa register_participant');
select ok(has_function_privilege('anon', 'public.vagas_publicas()', 'execute'),
  'anon pode consultar vagas públicas');
select ok(not has_function_privilege('anon', 'public.admin_listar_inscricoes()', 'execute'),
  'anon NÃO executa funções admin');
-- Allowlist: função nova exposta a anon/authenticated precisa de teste de autorização antes de entrar aqui.
select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')),
  array['vagas_publicas', 'validar_certificado'],
  'anon só executa vagas_publicas e validar_certificado (código aleatório de 100 bits)');
select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')),
  array['admin_cancelar_inscricao', 'admin_corrigir_inscricao', 'admin_definir_carga', 'admin_definir_janelas',
        'admin_definir_status_trabalho', 'admin_definir_vagas', 'admin_liberar_certificados',
        'admin_listar_atividades', 'admin_listar_inscricoes', 'admin_obter_config', 'admin_obter_modelo_certificado',
        'admin_reenviar_confirmacao', 'admin_resumo_certificados', 'admin_resumo_emails', 'admin_resumo_presencas',
        'admin_salvar_modelo_certificado', 'cancel_registration', 'pode_administrar', 'vagas_publicas',
        'validar_certificado'],
  'authenticated só executa as RPCs do painel (todas checam organizadores)');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')), 0,
  'toda função SECURITY DEFINER tem search_path fixo');

-- vagas_publicas não expõe dados pessoais ------------------------------------
insert into public.minicursos (id, slug, titulo, vagas, ocupadas) values (92, 'teste-sec', 'Teste', 10, 3);
select is((select restantes from public.vagas_publicas() where slug = 'teste-sec'), 7,
  'vagas_publicas devolve vagas restantes');

-- admin -----------------------------------------------------------------------
update public.config_evento
   set inscricoes_inicio = now() - interval '1 day', inscricoes_fim = now() + interval '1 day';
select * from public.register_participant('Fulano Teste', '52998224725', 'fulano@exemplo.com', null, '{}', null);
insert into public.organizadores (email) values ('org@exemplo.com');

set local request.jwt.claims = '{"role":"authenticated","email":"intruso@exemplo.com"}';
select throws_ok('select * from public.admin_listar_inscricoes()', 'P0001', 'NAO_AUTORIZADO',
  'usuário autenticado que não é organizador é recusado');

set local request.jwt.claims = '{"role":"authenticated","email":"org@exemplo.com"}';
select is((select cpf_mascarado from public.admin_listar_inscricoes() where email = 'fulano@exemplo.com'),
  '***.982.247-**', 'organizador recebe CPF mascarado');
select ok(not exists (select 1 from public.admin_listar_inscricoes() l where l::text like '%52998224725%'),
  'CPF completo nunca aparece na listagem do admin');

-- storage e integridade --------------------------------------------------------
select is((select public from storage.buckets where id = 'trabalhos'), false, 'bucket de trabalhos é privado');

-- Upload só pela Edge Function (service_role): ninguém grava direto no bucket.
set local role anon;
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('trabalhos', 'anon.pdf') $$, '42501', null,
  'anon NÃO grava no bucket de trabalhos');
reset role;
set local request.jwt.claims = '{"role":"authenticated","email":"org@exemplo.com"}';
set local role authenticated;
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('trabalhos', 'org.pdf') $$, '42501', null,
  'nem organizador grava direto no bucket de trabalhos');
reset role;

select throws_ok($$ update public.minicursos set ocupadas = 11 where id = 92 $$, '23514', null,
  'banco impede ocupadas > vagas mesmo em UPDATE direto');

select * from finish();
rollback;
