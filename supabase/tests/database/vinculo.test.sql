-- Vínculo Estudante / Docente / Outro com campo livre (WML-72).
-- Conversão dos dados da WML-69 (graduacao/mestrado → estudante), valores legados aceitos durante o
-- deploy, texto do "Outro" (até 40 caracteres) e as RPCs recriadas com as mesmas permissões.
-- CPFs e e-mails sintéticos — nunca use dados reais.
begin;
select plan(61);

update public.config_evento
   set inscricoes_inicio = now() - interval '1 day', inscricoes_fim = now() + interval '1 day',
       submissoes_inicio = now() - interval '1 day', submissoes_fim = now() + interval '1 day';
update public.minicursos set vagas = 10, ocupadas = 0 where slug = 'ml-na-pratica';
insert into public.organizadores (email) values ('org.vinculo@exemplo.com');

-- estrutura -------------------------------------------------------------------------
select has_column('public', 'participantes', 'vinculo_outro', 'participantes.vinculo_outro existe');
select col_type_is('public', 'participantes', 'vinculo', 'vinculo_participante',
  'vinculo continua no tipo vinculo_participante');
select enum_has_labels('public', 'vinculo_participante', array['estudante', 'docente', 'outro'],
  'vínculo passa a ser estudante, docente ou outro');
select is(
  (select count(*)::int from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e' and t.typname like 'vinculo%'), 1,
  'o tipo antigo (graduacao/mestrado) foi removido');
select enum_has_labels('public', 'nivel_premio', array['graduacao', 'mestrado'],
  'categoria do prêmio NÃO muda');
select ok((select relrowsecurity from pg_class where oid = 'public.participantes'::regclass),
  'RLS continua ligado em participantes');
select ok(not has_column_privilege('anon', 'public.participantes', 'vinculo_outro', 'select'),
  'anon NÃO lê vinculo_outro');

-- conversão: a mesma função converte os dados antigos na migration e os valores legados nas RPCs
select is(public.converter_vinculo('graduacao')::text, 'estudante', 'graduacao → estudante');
select is(public.converter_vinculo('mestrado')::text, 'estudante', 'mestrado → estudante');
select is(public.converter_vinculo('outro')::text, 'outro', 'outro continua outro');
select is(public.converter_vinculo('docente')::text, 'docente', 'docente é aceito');
select is(public.converter_vinculo(null), null, 'sem vínculo continua sem vínculo');
select throws_ok($$ select public.converter_vinculo('doutorado') $$,
  'P0001', 'VINCULO_INVALIDO', 'valor desconhecido é recusado');

-- permissões das funções recriadas ------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.converter_vinculo(text)', 'execute'),
  'anon NÃO chama converter_vinculo');
select ok(not has_function_privilege('authenticated', 'public.converter_vinculo(text)', 'execute'),
  'authenticated NÃO chama converter_vinculo');
select hasnt_function('public', 'register_participant',
  array['text', 'text', 'text', 'text', 'smallint[]', 'jsonb', 'text', 'text', 'text'],
  'assinatura antiga de register_participant foi removida');
select ok(not has_function_privilege('anon',
  'public.register_participant(text,text,text,text,smallint[],jsonb,text,text,text,text)', 'execute'),
  'anon NÃO chama register_participant');
select ok(not has_function_privilege('authenticated',
  'public.register_participant(text,text,text,text,smallint[],jsonb,text,text,text,text)', 'execute'),
  'authenticated NÃO chama register_participant');
select ok(has_function_privilege('service_role',
  'public.register_participant(text,text,text,text,smallint[],jsonb,text,text,text,text)', 'execute'),
  'service_role (Edge Function) chama register_participant');
select hasnt_function('public', 'admin_corrigir_inscricao',
  array['text', 'text', 'text', 'text', 'text', 'text', 'text', 'text'],
  'assinatura antiga de admin_corrigir_inscricao foi removida');
select ok(not has_function_privilege('anon',
  'public.admin_corrigir_inscricao(text,text,text,text,text,text,text,text,text)', 'execute'),
  'anon NÃO corrige inscrição');
select ok(has_function_privilege('authenticated',
  'public.admin_corrigir_inscricao(text,text,text,text,text,text,text,text,text)', 'execute'),
  'authenticated chama a correção (a função checa organizadores)');
select ok(not has_function_privilege('anon', 'public.admin_listar_inscricoes()', 'execute'),
  'anon NÃO lista inscrições');
select ok(has_function_privilege('authenticated', 'public.admin_listar_inscricoes()', 'execute'),
  'authenticated lista (a função checa organizadores)');

-- inscrição -----------------------------------------------------------------------------
create temp table insc as
  select 'est' as quem, * from public.register_participant('Ana Vinculo', '529.982.247-25',
    'ana.vinculo@exemplo.com', null, '{}', null, 'estudante', null, 'lattes.cnpq.br/1234567890123456', null)
  union all
  select 'doc', * from public.register_participant('Bia Vinculo', '111.444.777-35',
    'bia.vinculo@exemplo.com', null, '{}', null, 'docente', null, 'lattes.cnpq.br/1234567890123456', '   ')
  union all
  select 'out', * from public.register_participant('Caio Vinculo', '123.456.789-09',
    'caio.vinculo@exemplo.com', null, '{}', null, 'outro', null, 'lattes.cnpq.br/1234567890123456', '  Servidor   técnico ')
  union all
  select 'grad', * from public.register_participant('Davi Vinculo', '390.533.447-05',
    'davi.vinculo@exemplo.com', null, '{}', null, 'graduacao', null, 'lattes.cnpq.br/1234567890123456', null)
  union all
  select 'mest', * from public.register_participant('Eva Vinculo', '935.411.347-80',
    'eva.vinculo@exemplo.com', null, '{}', null, 'mestrado', null, 'lattes.cnpq.br/1234567890123456')
  union all
  select 'max', * from public.register_participant('Gil Vinculo', '10000000019',
    'gil.vinculo@exemplo.com', null, '{}', null, 'outro', null, 'lattes.cnpq.br/1234567890123456', repeat('x', 40));

create function pg_temp.vinc(p_email text) returns table (vinculo text, vinculo_outro text)
language sql as $$
  select p.vinculo::text, p.vinculo_outro from public.participantes p where p.email = p_email $$;

select results_eq($$ select * from pg_temp.vinc('ana.vinculo@exemplo.com') $$,
  $$ values ('estudante', null::text) $$, 'estudante sem texto');
select results_eq($$ select * from pg_temp.vinc('bia.vinculo@exemplo.com') $$,
  $$ values ('docente', null::text) $$, 'docente: texto em branco é ignorado');
select results_eq($$ select * from pg_temp.vinc('caio.vinculo@exemplo.com') $$,
  $$ values ('outro', 'Servidor técnico') $$, 'outro grava o texto sem espaços extras');
select results_eq($$ select * from pg_temp.vinc('davi.vinculo@exemplo.com') $$,
  $$ values ('estudante', null::text) $$, 'legado graduacao (página antiga) é gravado como estudante');
select results_eq($$ select * from pg_temp.vinc('eva.vinculo@exemplo.com') $$,
  $$ values ('estudante', null::text) $$,
  'legado mestrado sem o parâmetro novo (Edge Function antiga) é gravado como estudante');
select is((select char_length(vinculo_outro) from public.participantes where email = 'gil.vinculo@exemplo.com'),
  40, 'texto do outro aceita até 40 caracteres');

select throws_ok($$ select * from public.register_participant('Hugo Vinculo', '20000000027',
  'hugo.vinculo@exemplo.com', null, '{}', null, 'outro', null, 'lattes.cnpq.br/1234567890123456', null) $$,
  'P0001', 'VINCULO_OUTRO_INVALIDO', 'outro sem texto é recusado');
select throws_ok($$ select * from public.register_participant('Hugo Vinculo', '20000000027',
  'hugo.vinculo@exemplo.com', null, '{}', null, 'outro', null, 'lattes.cnpq.br/1234567890123456') $$,
  'P0001', 'VINCULO_OUTRO_INVALIDO', 'outro vindo da Edge Function antiga (sem texto) é recusado');
select throws_ok($$ select * from public.register_participant('Hugo Vinculo', '20000000027',
  'hugo.vinculo@exemplo.com', null, '{}', null, 'outro', null, 'lattes.cnpq.br/1234567890123456', '    ') $$,
  'P0001', 'VINCULO_OUTRO_INVALIDO', 'outro só com espaços é recusado');
select throws_ok($$ select * from public.register_participant('Hugo Vinculo', '20000000027',
  'hugo.vinculo@exemplo.com', null, '{}', null, 'outro', null, 'lattes.cnpq.br/1234567890123456', repeat('x', 41)) $$,
  'P0001', 'VINCULO_OUTRO_INVALIDO', 'texto do outro com 41 caracteres é recusado');
select throws_ok($$ select * from public.register_participant('Hugo Vinculo', '20000000027',
  'hugo.vinculo@exemplo.com', null, '{}', null, 'estudante', null, 'lattes.cnpq.br/1234567890123456', 'Servidor') $$,
  'P0001', 'VINCULO_OUTRO_INVALIDO', 'texto com estudante é recusado');
select throws_ok($$ select * from public.register_participant('Hugo Vinculo', '20000000027',
  'hugo.vinculo@exemplo.com', null, '{}', null, 'docente', null, 'lattes.cnpq.br/1234567890123456', 'Servidor') $$,
  'P0001', 'VINCULO_OUTRO_INVALIDO', 'texto com docente é recusado');
select throws_ok($$ select * from public.register_participant('Hugo Vinculo', '20000000027',
  'hugo.vinculo@exemplo.com', null, '{}', null, 'doutorado', null, 'lattes.cnpq.br/1234567890123456', null) $$,
  'P0001', 'VINCULO_INVALIDO', 'vínculo desconhecido é recusado');

-- ADR-003 intacto: vínculo inválido não ocupa vaga; inscrição válida ocupa uma
select throws_ok($$ select * from public.register_participant('Hugo Vinculo', '20000000027',
  'hugo.vinculo@exemplo.com', null, array[(select id from public.minicursos where slug = 'ml-na-pratica')],
  null, 'outro', null, 'lattes.cnpq.br/1234567890123456', null) $$,
  'P0001', 'VINCULO_OUTRO_INVALIDO', 'com minicurso, outro sem texto também é recusado');
select is((select ocupadas from public.minicursos where slug = 'ml-na-pratica'), 0,
  'inscrição recusada não ocupa vaga');
select lives_ok($$ insert into insc select 'mc', * from public.register_participant('Hugo Vinculo',
  '20000000027', 'hugo.vinculo@exemplo.com', null,
  array[(select id from public.minicursos where slug = 'ml-na-pratica')], null, 'docente', null, 'lattes.cnpq.br/1234567890123456', null) $$,
  'inscrição com minicurso continua funcionando');
select is((select ocupadas from public.minicursos where slug = 'ml-na-pratica'), 1,
  'e ocupa exatamente uma vaga');

-- coluna: defesa em profundidade (formato) + inscrições antigas aceitas -----------------------
select throws_ok($$ insert into public.participantes (nome, cpf, email, vinculo, vinculo_outro)
  values ('Ivo Direto', '52998224725', 'ivo.direto@exemplo.com', 'estudante', 'Servidor') $$,
  '23514', null, 'a coluna barra texto fora do outro');
select throws_ok($$ insert into public.participantes (nome, cpf, email, vinculo_outro)
  values ('Ivo Direto', '52998224725', 'ivo.direto@exemplo.com', 'Servidor') $$,
  '23514', null, 'a coluna barra texto sem vínculo');
select throws_ok($$ insert into public.participantes (nome, cpf, email, vinculo, vinculo_outro)
  values ('Ivo Direto', '52998224725', 'ivo.direto@exemplo.com', 'outro', ' Servidor  técnico') $$,
  '23514', null, 'a coluna barra espaços extras');
select throws_ok($$ insert into public.participantes (nome, cpf, email, vinculo, vinculo_outro)
  values ('Ivo Direto', '52998224725', 'ivo.direto@exemplo.com', 'outro', repeat('x', 41)) $$,
  '23514', null, 'a coluna barra mais de 40 caracteres');
-- Inscrição da WML-69 com "outro" e sem texto: continua válida (cancelar e expurgar não podem quebrar).
insert into public.participantes (nome, cpf, email, vinculo)
values ('Juca Legado', '52998224725', 'juca.legado@exemplo.com', 'outro');
select lives_ok($$ update public.participantes set cancelada_em = now() where email = 'juca.legado@exemplo.com' $$,
  'inscrição antiga com outro e sem texto pode ser atualizada');
update public.participantes set cancelada_em = null where email = 'juca.legado@exemplo.com';

-- painel da organização ------------------------------------------------------------------
set local request.jwt.claims = '{"role":"authenticated","email":"org.vinculo@exemplo.com"}';
select results_eq(
  $$ select vinculo, vinculo_outro from public.admin_listar_inscricoes() where nome = 'Caio Vinculo' $$,
  $$ values ('outro', 'Servidor técnico') $$,
  'a listagem do painel traz o texto do outro');

create function pg_temp.corrigir(p_quem text, p_vinculo text, p_outro text) returns void
language sql as $$
  select public.admin_corrigir_inscricao(n.numero_inscricao, p.nome, p.email,
    case p_quem when 'est' then '529.982.247-25' when 'out' then '123.456.789-09' else '390.533.447-05' end,
    null, p_vinculo, null, null, p_outro)
    from insc n join public.participantes p on p.id = n.id_inscricao where n.quem = p_quem $$;

select lives_ok($$ select pg_temp.corrigir('est', 'outro', ' Técnica  administrativa ') $$,
  'organização muda estudante → outro com texto');
select results_eq($$ select * from pg_temp.vinc('ana.vinculo@exemplo.com') $$,
  $$ values ('outro', 'Técnica administrativa') $$, 'correção grava o texto normalizado');
select throws_ok($$ select pg_temp.corrigir('est', 'outro', '') $$,
  'P0001', 'VINCULO_OUTRO_INVALIDO', 'correção para outro exige texto');
select throws_ok($$ select pg_temp.corrigir('est', 'docente', 'Servidor') $$,
  'P0001', 'VINCULO_OUTRO_INVALIDO', 'correção recusa texto com docente');
select lives_ok($$ select pg_temp.corrigir('est', 'docente', null) $$,
  'organização muda outro → docente');
select results_eq($$ select * from pg_temp.vinc('ana.vinculo@exemplo.com') $$,
  $$ values ('docente', null::text) $$, 'sair do outro apaga o texto');
select lives_ok($$ select pg_temp.corrigir('out', null, null) $$,
  'correção sem vínculo mantém vínculo e texto');
select results_eq($$ select * from pg_temp.vinc('caio.vinculo@exemplo.com') $$,
  $$ values ('outro', 'Servidor técnico') $$, 'vínculo e texto preservados');
select lives_ok($$ select pg_temp.corrigir('grad', 'mestrado', null) $$,
  'correção aceita valor legado (página antiga do painel)');
select results_eq($$ select * from pg_temp.vinc('davi.vinculo@exemplo.com') $$,
  $$ values ('estudante', null::text) $$, 'legado vira estudante na correção');
select lives_ok($$ select public.admin_corrigir_inscricao(
  (select numero from public.participantes where email = 'juca.legado@exemplo.com'), 'Juca Legado',
  'juca.novo@exemplo.com', '529.982.247-25', null) $$,
  'inscrição antiga com outro e sem texto ainda pode ter o e-mail corrigido');

set local request.jwt.claims = '{"role":"authenticated","email":"intruso.vinculo@exemplo.com"}';
select throws_ok($$ select pg_temp.corrigir('out', 'docente', null) $$,
  'P0001', 'NAO_AUTORIZADO', 'quem não é organizador não corrige');
reset request.jwt.claims;

-- expurgo LGPD: o texto livre sai junto com curso e perfil ------------------------------------
select ok((public.expurgar_dados('2027-04-01') ->> 'dados_pessoais')::int >= 1, 'expurgo roda após o prazo');
select is((select count(*)::int from public.participantes where vinculo_outro is not null), 0,
  'expurgo apaga o texto do outro');

select * from finish();
rollback;