-- Vínculo, curso e perfil LinkedIn/Lattes na inscrição (WML-69), para o crachá.
-- O link vira QR impresso: só LinkedIn (/in/) e Lattes (16 dígitos), sempre em https.
-- CPFs e e-mails sintéticos — nunca use dados reais.
begin;
select plan(28);

update public.config_evento
   set inscricoes_inicio = now() - interval '1 day', inscricoes_fim = now() + interval '1 day',
       submissoes_inicio = now() - interval '1 day', submissoes_fim = now() + interval '1 day';
insert into public.organizadores (email) values ('org.perfil@exemplo.com');

-- estrutura e RLS -----------------------------------------------------------------
select has_column('public', 'participantes', 'vinculo', 'participantes.vinculo existe');
select has_column('public', 'participantes', 'curso', 'participantes.curso existe');
select has_column('public', 'participantes', 'perfil_url', 'participantes.perfil_url existe');
select ok((select relrowsecurity from pg_class where oid = 'public.participantes'::regclass),
  'RLS continua ligado em participantes');
select ok(not has_table_privilege('anon', 'public.participantes', 'select'), 'anon NÃO lê participantes');
select ok(not has_function_privilege('anon',
  'public.register_participant(text,text,text,text,smallint[],jsonb,text,text,text)', 'execute'),
  'anon NÃO chama a RPC de inscrição');

-- normalização do perfil ---------------------------------------------------------
select is(public.normalizar_perfil('linkedin.com/in/ana-souza/'), 'https://www.linkedin.com/in/ana-souza',
  'LinkedIn sem esquema vira https canônico');
select is(public.normalizar_perfil('http://br.linkedin.com/in/ana_souza-01?utm=x'),
  'https://www.linkedin.com/in/ana_souza-01', 'subdomínio e query são descartados');
select is(public.normalizar_perfil('http://lattes.cnpq.br/1234567890123456'),
  'https://lattes.cnpq.br/1234567890123456', 'Lattes vira https');
select is(public.normalizar_perfil('  '), null, 'vazio = sem perfil');
select throws_ok($$ select public.normalizar_perfil('https://linkedin.com.evil.com/in/ana') $$,
  'P0001', 'PERFIL_INVALIDO', 'domínio parecido é recusado');
select throws_ok($$ select public.normalizar_perfil('https://www.linkedin.com/company/ic-ufal') $$,
  'P0001', 'PERFIL_INVALIDO', 'página que não é de pessoa é recusada');
select throws_ok($$ select public.normalizar_perfil('javascript:alert(1)') $$,
  'P0001', 'PERFIL_INVALIDO', 'esquema perigoso é recusado');
select throws_ok($$ select public.normalizar_perfil('https://lattes.cnpq.br/123') $$,
  'P0001', 'PERFIL_INVALIDO', 'Lattes precisa de 16 dígitos');

-- inscrição -----------------------------------------------------------------------
create temp table insc as
  select 'ana' as quem, * from public.register_participant('Ana Perfil', '529.982.247-25',
    'ana.perfil@exemplo.com', 'UFAL', '{}', null, 'graduacao', ' Ciência  da Computação ',
    'linkedin.com/in/ana-perfil')
  union all
  select 'bia', * from public.register_participant('Bia Perfil', '111.444.777-35',
    'bia.perfil@exemplo.com', null, '{}', null, 'mestrado', null, null);

select results_eq(
  $$ select vinculo::text, curso, perfil_url from public.participantes where email = 'ana.perfil@exemplo.com' $$,
  $$ values ('graduacao', 'Ciência da Computação', 'https://www.linkedin.com/in/ana-perfil') $$,
  'grava vínculo, curso (sem espaços extras) e perfil canônico');
select results_eq(
  $$ select vinculo::text, curso, perfil_url from public.participantes where email = 'bia.perfil@exemplo.com' $$,
  $$ values ('mestrado', null::text, null::text) $$,
  'curso e perfil são opcionais');
select throws_ok($$ select * from public.register_participant('Caio Perfil', '123.456.789-09',
  'caio.perfil@exemplo.com', null, '{}', null, 'doutorado', null, null) $$,
  'P0001', 'VINCULO_INVALIDO', 'vínculo fora da lista é recusado');
select throws_ok($$ select * from public.register_participant('Caio Perfil', '123.456.789-09',
  'caio.perfil@exemplo.com', null, '{}', null, 'outro', repeat('x', 121), null) $$,
  'P0001', 'CURSO_INVALIDO', 'curso com mais de 120 caracteres é recusado');
select throws_ok($$ select * from public.register_participant('Caio Perfil', '123.456.789-09',
  'caio.perfil@exemplo.com', null, '{}', null, 'outro', null, 'https://evil.com/in/caio') $$,
  'P0001', 'PERFIL_INVALIDO', 'perfil fora de LinkedIn/Lattes é recusado na inscrição');
select throws_ok($$ insert into public.participantes (nome, cpf, email, perfil_url)
  values ('Dado Direto', '52998224725', 'direto@exemplo.com', 'https://evil.com') $$,
  '23514', null, 'a coluna também barra link fora do formato (defesa em profundidade)');

-- painel da organização ---------------------------------------------------------------
set local request.jwt.claims = '{"role":"authenticated","email":"org.perfil@exemplo.com"}';
select results_eq(
  $$ select vinculo, curso, perfil_url from public.admin_listar_inscricoes() where nome = 'Ana Perfil' $$,
  $$ values ('graduacao', 'Ciência da Computação', 'https://www.linkedin.com/in/ana-perfil') $$,
  'a listagem do painel traz vínculo, curso e perfil');

select lives_ok($$ select public.admin_corrigir_inscricao(
  (select numero_inscricao from insc where quem = 'bia'), 'Bia Perfil', 'bia.perfil@exemplo.com',
  '111.444.777-35', null, 'outro', 'Engenharia', 'lattes.cnpq.br/1234567890123456') $$,
  'organização corrige vínculo, curso e perfil');
select results_eq(
  $$ select vinculo::text, curso, perfil_url from public.participantes where email = 'bia.perfil@exemplo.com' $$,
  $$ values ('outro', 'Engenharia', 'https://lattes.cnpq.br/1234567890123456') $$,
  'correção grava os valores normalizados');
select lives_ok($$ select public.admin_corrigir_inscricao(
  (select numero_inscricao from insc where quem = 'bia'), 'Bia Perfil', 'bia.perfil@exemplo.com',
  '111.444.777-35', null) $$, 'correção sem os campos novos continua funcionando');
select results_eq(
  $$ select vinculo::text, curso from public.participantes where email = 'bia.perfil@exemplo.com' $$,
  $$ values ('outro', 'Engenharia') $$,
  'parâmetro ausente mantém o valor atual');
select lives_ok($$ select public.admin_corrigir_inscricao(
  (select numero_inscricao from insc where quem = 'bia'), 'Bia Perfil', 'bia.perfil@exemplo.com',
  '111.444.777-35', null, null, '', '') $$, 'texto vazio apaga curso e perfil');
reset request.jwt.claims;

-- expurgo LGPD ------------------------------------------------------------------------
select ok((public.expurgar_dados('2027-04-01') ->> 'dados_pessoais')::int >= 2, 'expurgo roda após o prazo');
select is((select count(*)::int from public.participantes where curso is not null or perfil_url is not null), 0,
  'expurgo apaga curso e perfil junto com CPF e e-mail');

select * from finish();
rollback;
