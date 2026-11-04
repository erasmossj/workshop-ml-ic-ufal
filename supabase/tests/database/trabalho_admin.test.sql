-- Organização inclui, corrige ou retira o trabalho de quem apresenta (WML-79).
-- Casos: desistiu de apresentar (retira só o trabalho; inscrição e minicurso ficam), digitou errado
-- (corrige título, autores e resumo) e decidiu apresentar de última hora (inclui, mesmo fora da
-- janela de submissão). Mesmos limites da inscrição. Nenhum e-mail automático (há "Reenviar").
-- CPFs e e-mails sintéticos.
begin;
select plan(66);

delete from public.participantes;
delete from public.acervo_trabalhos;
delete from public.pdfs_a_apagar;
-- Janela de submissão já fechada: a organização inclui mesmo assim.
update public.config_evento
   set inscricoes_inicio = now() - interval '10 days', inscricoes_fim = now() + interval '1 day',
       submissoes_inicio = now() - interval '10 days', submissoes_fim = now() - interval '1 day';
update public.minicursos set vagas = 10, ocupadas = 0 where slug = 'ml-na-pratica';
insert into public.organizadores (email) values ('org.trabalho@exemplo.com');

create temp table insc (quem text primary key, id uuid, numero text);
with novos as (
  insert into public.participantes (nome, cpf, email)
  values ('Pessoa Ana Trabalho', '52998224725', 'ana.trab@exemplo.com'),
         ('Pessoa Bia Trabalho', '11144477735', 'bia.trab@exemplo.com'),
         ('Pessoa Caio Trabalho', '12345678909', 'caio.trab@exemplo.com'),
         ('Pessoa Cancel Trabalho', '98765432100', 'cancel.trab@exemplo.com')
  returning id, numero, email
)
insert into insc select split_part(email, '.', 1), id, numero from novos;
create function pg_temp.num(p_quem text) returns text language sql as $$
  select numero from insc where quem = p_quem $$;
create function pg_temp.pid(p_quem text) returns uuid language sql as $$
  select id from insc where quem = p_quem $$;
create function pg_temp.trab(p_quem text) returns public.trabalhos language sql as $$
  select t from public.trabalhos t where t.participante_id = pg_temp.pid(p_quem) $$;
create function pg_temp.emails(p_quem text) returns integer language sql as $$
  select count(*)::int from public.email_outbox o
   where o.participante_id = pg_temp.pid(p_quem) and o.status in ('pendente', 'enviando') $$;

-- Bia: só assistia, depois entrou no minicurso; Caio e Cancel já apresentavam (Caio com PDF
-- enviado até 03/11 e já no acervo).
set local request.jwt.claims = '{"role":"service_role"}';
select public.admin_alterar_minicurso(pg_temp.num('bia'), (select id from public.minicursos where slug = 'ml-na-pratica'), true);
reset request.jwt.claims;
insert into public.trabalhos (participante_id, titulo, autores, resumo, status, pdf_path, acervo, acervo_em)
values (pg_temp.pid('caio'), 'Trabalho do Caio', 'Caio Autor', 'Resumo original do Caio.', 'aprovado_oral',
        'pdf-caio.pdf', true, now()),
       (pg_temp.pid('cancel'), 'Trabalho Cancelado', 'Autor Cancel', 'Resumo de quem cancelou.', 'pendente',
        null, false, null);
with a as (
  insert into public.acervo_trabalhos (edicao, titulo, autores, resumo, status, pdf_path)
  values (2026, 'Trabalho do Caio', 'Caio Autor', 'Resumo original do Caio.', 'aprovado_oral', 'pdf-caio-acervo.pdf')
  returning id
)
update public.trabalhos t set acervo_id = a.id from a where t.participante_id = pg_temp.pid('caio');
update public.participantes set cancelada_em = now() where id = pg_temp.pid('cancel');
update public.email_outbox set status = 'enviado', enviado_em = now();

-- estrutura e acesso ----------------------------------------------------------------------
select has_function('public', 'admin_salvar_trabalho', array['text', 'text', 'text', 'text'],
  'admin_salvar_trabalho(numero, titulo, autores, resumo) existe');
select has_function('public', 'admin_retirar_trabalho', array['text'],
  'admin_retirar_trabalho(numero) existe');
select is((select prosecdef from pg_proc where oid = 'public.admin_salvar_trabalho(text,text,text,text)'::regprocedure),
  true, 'salvar é security definer (a tabela não tem policy)');
select is((select prosecdef from pg_proc where oid = 'public.admin_retirar_trabalho(text)'::regprocedure),
  true, 'retirar é security definer');
select ok(not has_function_privilege('anon', 'public.admin_salvar_trabalho(text,text,text,text)', 'execute'),
  'anon NÃO salva trabalho');
select ok(not has_function_privilege('anon', 'public.admin_retirar_trabalho(text)', 'execute'),
  'anon NÃO retira trabalho');
select ok(has_function_privilege('authenticated', 'public.admin_salvar_trabalho(text,text,text,text)', 'execute'),
  'authenticated chama salvar (a função checa organizadores)');
select ok(has_function_privilege('authenticated', 'public.admin_retirar_trabalho(text)', 'execute'),
  'authenticated chama retirar (a função checa organizadores)');

-- autorização -------------------------------------------------------------------------------
set local role anon;
-- Número literal: anon não lê as tabelas temporárias do teste (o privilégio barra antes de executar).
select throws_ok($$ select public.admin_salvar_trabalho('ICML26-0001', 'Título', 'Autora', 'Resumo do trabalho.') $$,
  '42501', null, 'anon é barrado pelo privilégio');
reset role;
set local request.jwt.claims = '{"role":"authenticated","email":"intruso@exemplo.com"}';
select throws_ok($$ select public.admin_salvar_trabalho(pg_temp.num('ana'), 'Título', 'Autora', 'Resumo do trabalho.') $$,
  'P0001', 'NAO_AUTORIZADO', 'quem não é organizador não inclui');
select throws_ok($$ select public.admin_retirar_trabalho(pg_temp.num('caio')) $$,
  'P0001', 'NAO_AUTORIZADO', 'quem não é organizador não retira');
select ok((pg_temp.trab('ana')).id is null, 'recusa não cria trabalho');
select ok((pg_temp.trab('caio')).id is not null, 'recusa não apaga trabalho');

set local request.jwt.claims = '{"role":"authenticated","email":"org.trabalho@exemplo.com"}';

-- incluir (só assistia; janela de submissão fechada) ------------------------------------------
select lives_ok($$ select public.admin_salvar_trabalho(pg_temp.num('ana'),
    '  Redes   neurais  na   UFAL ', E'Ana Autora,\n  Beto   Coautor ',
    E'  Um resumo com mais de dez caracteres.\nSegunda linha.  ') $$,
  'organizador inclui trabalho fora da janela de submissão');
select is((pg_temp.trab('ana')).titulo, 'Redes neurais na UFAL', 'título com espaços normalizados');
select is((pg_temp.trab('ana')).autores, 'Ana Autora, Beto Coautor', 'autores com espaços normalizados');
select is((pg_temp.trab('ana')).resumo, E'Um resumo com mais de dez caracteres.\nSegunda linha.',
  'resumo aparado nas pontas, quebras de linha mantidas');
select is((pg_temp.trab('ana')).status, 'pendente'::public.status_trabalho, 'entra como pendente');
select is((pg_temp.trab('ana')).acervo, false, 'sem autorização do acervo (opt-in é do autor)');
select ok((pg_temp.trab('ana')).acervo_em is null, 'sem data de autorização');
select is((pg_temp.trab('ana')).premio, false, 'sem premiação');
select ok((pg_temp.trab('ana')).pdf_path is null, 'sem PDF');
select is(pg_temp.emails('ana'), 0, 'nenhum e-mail automático (a organização usa "Reenviar")');

-- corrigir ----------------------------------------------------------------------------------
select public.admin_definir_status_trabalho(pg_temp.num('ana'), 'aprovado_poster');
update public.trabalhos set acervo = true, acervo_em = now() - interval '1 day'
 where participante_id = pg_temp.pid('ana');
create temp table antes as select * from public.trabalhos where participante_id = pg_temp.pid('ana');
select lives_ok($$ select public.admin_salvar_trabalho(pg_temp.num('ana'),
    'Redes neurais no IC', 'Ana Autora', 'Resumo corrigido pela organização.') $$,
  'organizador corrige o trabalho');
select is((pg_temp.trab('ana')).titulo, 'Redes neurais no IC', 'título corrigido');
select is((pg_temp.trab('ana')).autores, 'Ana Autora', 'autores corrigidos');
select is((pg_temp.trab('ana')).resumo, 'Resumo corrigido pela organização.', 'resumo corrigido');
select is((pg_temp.trab('ana')).id, (select id from antes), 'corrige o mesmo trabalho (não cria outro)');
select is((pg_temp.trab('ana')).status, 'aprovado_poster'::public.status_trabalho, 'status mantido');
select is((pg_temp.trab('ana')).acervo, true, 'autorização do acervo mantida');
select is((pg_temp.trab('ana')).acervo_em, (select acervo_em from antes), 'data da autorização mantida');
select is((select count(*)::int from public.trabalhos where participante_id = pg_temp.pid('ana')), 1,
  'um trabalho por inscrição');
select is(pg_temp.emails('ana'), 0, 'correção não manda e-mail');

-- Já no acervo (depois de 31/01/2027): a cópia do acervo recebe a correção.
select lives_ok($$ select public.admin_salvar_trabalho(pg_temp.num('caio'),
    'Trabalho do Caio corrigido', 'Caio Autor', 'Resumo original do Caio.') $$,
  'corrige trabalho que já está no acervo');
select is((select titulo from public.acervo_trabalhos a
            where a.id = (pg_temp.trab('caio')).acervo_id), 'Trabalho do Caio corrigido',
  'a cópia do acervo acompanha a correção');

-- limites (iguais aos da inscrição) -------------------------------------------------------------
select throws_ok($$ select public.admin_salvar_trabalho(pg_temp.num('ana'), '  ab  ', 'Ana Autora', 'Resumo válido aqui.') $$,
  'P0001', 'TITULO_INVALIDO', 'título com menos de 3 caracteres (depois de aparar)');
select throws_ok($$ select public.admin_salvar_trabalho(pg_temp.num('ana'), repeat('x', 251), 'Ana Autora', 'Resumo válido aqui.') $$,
  'P0001', 'TITULO_INVALIDO', 'título com mais de 250 caracteres');
select throws_ok($$ select public.admin_salvar_trabalho(pg_temp.num('ana'), null, 'Ana Autora', 'Resumo válido aqui.') $$,
  'P0001', 'TITULO_INVALIDO', 'título vazio');
select throws_ok($$ select public.admin_salvar_trabalho(pg_temp.num('ana'), 'Título ok', 'ab', 'Resumo válido aqui.') $$,
  'P0001', 'AUTORES_INVALIDOS', 'autores com menos de 3 caracteres');
select throws_ok($$ select public.admin_salvar_trabalho(pg_temp.num('ana'), 'Título ok', repeat('a', 601), 'Resumo válido aqui.') $$,
  'P0001', 'AUTORES_INVALIDOS', 'autores com mais de 600 caracteres');
select throws_ok($$ select public.admin_salvar_trabalho(pg_temp.num('ana'), 'Título ok', 'Ana Autora', '  curto   ') $$,
  'P0001', 'RESUMO_INVALIDO', 'resumo com menos de 10 caracteres');
select throws_ok($$ select public.admin_salvar_trabalho(pg_temp.num('ana'), 'Título ok', 'Ana Autora', repeat('r', 1501)) $$,
  'P0001', 'RESUMO_INVALIDO', 'resumo com mais de 1500 caracteres');
select is((pg_temp.trab('ana')).titulo, 'Redes neurais no IC', 'recusa não altera o trabalho');
select lives_ok($$ select public.admin_salvar_trabalho(pg_temp.num('ana'), repeat('t', 250), repeat('a', 600), repeat('r', 1500)) $$,
  'aceita os tamanhos máximos');
select lives_ok($$ select public.admin_salvar_trabalho(pg_temp.num('ana'), 'abc', 'abc', repeat('r', 10)) $$,
  'aceita os tamanhos mínimos');

-- inscrição cancelada ou inexistente -----------------------------------------------------------
select throws_ok($$ select public.admin_salvar_trabalho(pg_temp.num('cancel'), 'Título novo', 'Autor', 'Resumo do trabalho.') $$,
  'P0001', 'INSCRICAO_CANCELADA', 'inscrição cancelada não recebe trabalho');
select throws_ok($$ select public.admin_retirar_trabalho(pg_temp.num('cancel')) $$,
  'P0001', 'INSCRICAO_CANCELADA', 'inscrição cancelada: trabalho não é retirado por aqui');
select is((pg_temp.trab('cancel')).titulo, 'Trabalho Cancelado', 'trabalho de cancelada intacto');
select throws_ok($$ select public.admin_salvar_trabalho('ICML26-9999', 'Título', 'Autor', 'Resumo do trabalho.') $$,
  'P0001', 'INSCRICAO_INEXISTENTE', 'inscrição que não existe');

-- retirar (desistiu de apresentar) --------------------------------------------------------------
select lives_ok($$ select public.admin_salvar_trabalho(pg_temp.num('bia'), 'Trabalho da Bia', 'Bia Autora', 'Resumo do trabalho da Bia.') $$,
  'inclui trabalho de quem está no minicurso');
select lives_ok($$ select public.admin_retirar_trabalho(pg_temp.num('bia')) $$,
  'organizador retira o trabalho');
select ok((pg_temp.trab('bia')).id is null, 'trabalho apagado');
select ok((select cancelada_em is null from public.participantes where id = pg_temp.pid('bia')),
  'inscrição continua ativa');
select ok(exists (select 1 from public.inscricoes_minicurso where participante_id = pg_temp.pid('bia')),
  'minicurso mantido');
select is((select ocupadas from public.minicursos where slug = 'ml-na-pratica'), 1, 'vaga do minicurso mantida');
select is(pg_temp.emails('bia'), 0, 'retirada não manda e-mail');
select lives_ok($$ select public.admin_retirar_trabalho(pg_temp.num('bia')) $$,
  'retirar de novo não dá erro');

-- Caio: PDF enviado até 03/11 e trabalho já no acervo (ADR-007).
create temp table acervo_caio as select (pg_temp.trab('caio')).acervo_id as id;
select lives_ok($$ select public.admin_retirar_trabalho(pg_temp.num('caio')) $$,
  'retira trabalho que tem PDF e está no acervo');
select ok((pg_temp.trab('caio')).id is null, 'trabalho do Caio apagado');
select ok(not exists (select 1 from public.acervo_trabalhos a where a.id = (select id from acervo_caio)),
  'sai também do acervo (título, autores e resumo na hora)');
select ok(exists (select 1 from public.pdfs_a_apagar where caminho = 'pdf-caio.pdf'),
  'PDF da inscrição vai para a fila do expurgo');
select ok(exists (select 1 from public.pdfs_a_apagar where caminho = 'pdf-caio-acervo.pdf'),
  'PDF do acervo vai para a fila do expurgo');

-- listagem do painel traz o trabalho para editar (CPF continua mascarado) ----------------------
select is((select autores_trabalho from public.admin_listar_inscricoes() where numero = pg_temp.num('ana')),
  'abc', 'listagem traz os autores');
select is((select resumo_trabalho from public.admin_listar_inscricoes() where numero = pg_temp.num('ana')),
  repeat('r', 10), 'listagem traz o resumo');
select ok((select not apresenta_trabalho and autores_trabalho is null and resumo_trabalho is null
             from public.admin_listar_inscricoes() where numero = pg_temp.num('bia')),
  'sem trabalho: listagem sem título, autores e resumo');
select ok(not exists (select 1 from public.admin_listar_inscricoes() l where l::text like '%52998224725%'),
  'CPF completo nunca aparece na listagem');

select * from finish();
rollback;
