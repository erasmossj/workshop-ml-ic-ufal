-- Organização inclui ou tira alguém do minicurso depois da inscrição (ADR-003 atualizado).
-- Mesma regra de vagas da inscrição: UPDATE condicional, sem overbooking; CPF único por minicurso.
-- Toda mudança põe o e-mail de confirmação (com o comprovante atualizado) na fila.
-- CPFs e e-mails sintéticos.
begin;
select plan(39);

delete from public.participantes;
update public.config_evento
   set inscricoes_inicio = now() - interval '1 day', inscricoes_fim = now() + interval '1 day';
update public.minicursos set vagas = null, ocupadas = 0 where slug = 'ml-na-pratica';
insert into public.organizadores (email) values ('org.minicurso@exemplo.com');

create function pg_temp.mc() returns smallint language sql as $$
  select id from public.minicursos where slug = 'ml-na-pratica' $$;
create function pg_temp.inscrever(p_quem text, p_cpf text) returns table (id_inscricao uuid, numero_inscricao text)
language sql as $$
  select * from public.register_participant('Pessoa ' || initcap(p_quem) || ' Minicurso', p_cpf,
    p_quem || '.mc@exemplo.com', 'UFAL', '{}', null, 'estudante', null, 'lattes.cnpq.br/1234567890123456', null)
$$;
create temp table insc as
            select 'ana' as quem, * from pg_temp.inscrever('ana', '529.982.247-25')
  union all select 'bia', * from pg_temp.inscrever('bia', '111.444.777-35')
  union all select 'caio', * from pg_temp.inscrever('caio', '123.456.789-09')
  -- CPF repetido (inscrição feita de novo com outro e-mail): pode existir, mas não ocupa 2 vagas.
  union all select 'anadup', * from pg_temp.inscrever('anadup', '529.982.247-25')
  union all select 'cancel', * from pg_temp.inscrever('cancel', '987.654.321-00');
create function pg_temp.num(p_quem text) returns text language sql as $$
  select numero_inscricao from insc where quem = p_quem $$;
create function pg_temp.pid(p_quem text) returns uuid language sql as $$
  select id_inscricao from insc where quem = p_quem $$;
create function pg_temp.no_mc(p_quem text) returns boolean language sql as $$
  select exists (select 1 from public.inscricoes_minicurso i where i.participante_id = pg_temp.pid(p_quem)) $$;
create function pg_temp.ocupadas() returns integer language sql as $$
  select ocupadas from public.minicursos where id = pg_temp.mc() $$;
create function pg_temp.emails(p_quem text) returns integer language sql as $$
  select count(*)::int from public.email_outbox o
   where o.participante_id = pg_temp.pid(p_quem) and o.tipo = 'confirmacao' and o.status = 'pendente' $$;
-- Confirmações da inscrição já "enviadas": assim dá para ver o novo e-mail entrar na fila.
update public.email_outbox set status = 'enviado', enviado_em = now();
set local request.jwt.claims = '{"role":"service_role"}';
select public.cancel_registration(pg_temp.pid('cancel'));
reset request.jwt.claims;

-- estrutura e acesso ----------------------------------------------------------------------
select has_function('public', 'admin_alterar_minicurso', array['text', 'smallint', 'boolean'],
  'admin_alterar_minicurso(numero, minicurso, inscrever) existe');
select is((select prosecdef from pg_proc where oid = 'public.admin_alterar_minicurso(text,smallint,boolean)'::regprocedure),
  true, 'security definer (a tabela não tem policy)');
select ok(not has_function_privilege('anon', 'public.admin_alterar_minicurso(text,smallint,boolean)', 'execute'),
  'anon NÃO altera minicurso');
select ok(has_function_privilege('authenticated', 'public.admin_alterar_minicurso(text,smallint,boolean)', 'execute'),
  'authenticated chama (a função checa organizadores)');

-- autorização -------------------------------------------------------------------------------
set local request.jwt.claims = '{"role":"authenticated","email":"intruso@exemplo.com"}';
select throws_ok($$ select public.admin_alterar_minicurso(pg_temp.num('ana'), pg_temp.mc(), true) $$,
  'P0001', 'NAO_AUTORIZADO', 'quem não é organizador é recusado');
select is(pg_temp.ocupadas(), 0, 'recusa não ocupa vaga');

set local request.jwt.claims = '{"role":"authenticated","email":"org.minicurso@exemplo.com"}';

-- minicurso ainda sem vagas definidas = fechado ---------------------------------------------
select throws_ok($$ select public.admin_alterar_minicurso(pg_temp.num('ana'), pg_temp.mc(), true) $$,
  'P0001', 'MINICURSO_FECHADO', 'sem vagas definidas, ninguém entra');
select throws_ok($$ select public.admin_alterar_minicurso(pg_temp.num('ana'), 999::smallint, true) $$,
  'P0001', 'MINICURSO_INEXISTENTE', 'minicurso que não existe');
select throws_ok($$ select public.admin_alterar_minicurso('ICML26-9999', pg_temp.mc(), true) $$,
  'P0001', 'INSCRICAO_INEXISTENTE', 'inscrição que não existe');

update public.minicursos set vagas = 2 where id = pg_temp.mc();

-- incluir -------------------------------------------------------------------------------------
select lives_ok($$ select public.admin_alterar_minicurso(pg_temp.num('ana'), pg_temp.mc(), true) $$,
  'organizador inclui no minicurso');
select ok(pg_temp.no_mc('ana'), 'inscrição de minicurso criada');
select is(pg_temp.ocupadas(), 1, 'ocupa 1 vaga');
select is(pg_temp.emails('ana'), 1, 'e-mail de confirmação atualizado na fila');
select is((select cpf from public.inscricoes_minicurso where participante_id = pg_temp.pid('ana')),
  (select cpf from public.participantes where id = pg_temp.pid('ana')), 'guarda o CPF (unicidade por minicurso)');

select lives_ok($$ select public.admin_alterar_minicurso(pg_temp.num('ana'), pg_temp.mc(), true) $$,
  'incluir de novo não dá erro');
select is(pg_temp.ocupadas(), 1, 'incluir de novo não ocupa outra vaga');
select is(pg_temp.emails('ana'), 1, 'incluir de novo não duplica o e-mail');

select throws_ok($$ select public.admin_alterar_minicurso(pg_temp.num('anadup'), pg_temp.mc(), true) $$,
  'P0001', 'CPF_JA_NO_MINICURSO', 'o mesmo CPF não ocupa duas vagas');
select is(pg_temp.ocupadas(), 1, 'CPF repetido não ocupa vaga');
select ok(not pg_temp.no_mc('anadup'), 'CPF repetido fica fora');

select lives_ok($$ select public.admin_alterar_minicurso(pg_temp.num('bia'), pg_temp.mc(), true) $$,
  'inclui até a última vaga');
select is(pg_temp.ocupadas(), 2, 'vagas cheias');
select throws_ok($$ select public.admin_alterar_minicurso(pg_temp.num('caio'), pg_temp.mc(), true) $$,
  'P0001', 'MINICURSO_ESGOTADO', 'sem vaga, a organização também não inclui (sem overbooking)');
select is(pg_temp.ocupadas(), 2, 'esgotado não passa do limite');
select ok(not pg_temp.no_mc('caio'), 'esgotado fica fora');
select is(pg_temp.emails('caio'), 0, 'recusa não manda e-mail');

select throws_ok($$ select public.admin_alterar_minicurso(pg_temp.num('cancel'), pg_temp.mc(), true) $$,
  'P0001', 'INSCRICAO_CANCELADA', 'inscrição cancelada não entra no minicurso');

-- tirar ---------------------------------------------------------------------------------------
update public.email_outbox set status = 'enviado', enviado_em = now();
select lives_ok($$ select public.admin_alterar_minicurso(pg_temp.num('bia'), pg_temp.mc(), false) $$,
  'organizador tira do minicurso');
select ok(not pg_temp.no_mc('bia'), 'inscrição de minicurso removida');
select is(pg_temp.ocupadas(), 1, 'vaga liberada');
select is(pg_temp.emails('bia'), 1, 'e-mail de confirmação atualizado na fila');
select ok((select p.cancelada_em is null from public.participantes p where p.id = pg_temp.pid('bia')),
  'a inscrição no evento continua ativa');

select lives_ok($$ select public.admin_alterar_minicurso(pg_temp.num('bia'), pg_temp.mc(), false) $$,
  'tirar quem já está fora não dá erro');
select is(pg_temp.ocupadas(), 1, 'tirar de novo não libera vaga a mais');

select lives_ok($$ select public.admin_alterar_minicurso(pg_temp.num('caio'), pg_temp.mc(), true) $$,
  'a vaga liberada pode ser usada');
select is(pg_temp.ocupadas(), 2, 'vaga reocupada');

-- com presença registrada no minicurso, não sai (histórico do certificado) ---------------------
insert into public.presencas (participante_id, dia, minicurso_id, origem, operador)
values (pg_temp.pid('ana'), '2026-12-02', pg_temp.mc(), 'manual', 'org.minicurso@exemplo.com');
select throws_ok($$ select public.admin_alterar_minicurso(pg_temp.num('ana'), pg_temp.mc(), false) $$,
  'P0001', 'MINICURSO_COM_PRESENCA', 'quem já tem presença no minicurso não é tirado');
select ok(pg_temp.no_mc('ana'), 'continua no minicurso');

-- invariante do ADR-003 -----------------------------------------------------------------------
select is(pg_temp.ocupadas(),
  (select count(*)::int from public.inscricoes_minicurso where minicurso_id = pg_temp.mc()),
  'ocupadas = inscritos no minicurso');

select * from finish();
rollback;
