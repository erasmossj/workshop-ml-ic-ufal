-- Acervo de trabalhos (WML-73 · ADR-007): só trabalhos APROVADOS e com autorização expressa do autor
-- (opt-in, revogável) ficam depois de 31/01/2027 — sem CPF, e-mail ou vínculo com a inscrição.
-- Os demais PDFs continuam saindo no expurgo de 31/01/2027. CPFs e e-mails sintéticos.
begin;
select plan(84);

-- O expurgo age sobre TODAS as inscrições: começa do zero (o rollback do fim desfaz).
delete from public.participantes;
delete from public.acervo_trabalhos;
delete from public.pdfs_a_apagar;

update public.config_evento
   set inscricoes_inicio = now() - interval '1 day', inscricoes_fim = now() + interval '1 day',
       submissoes_inicio = now() - interval '1 day', submissoes_fim = now() + interval '1 day';
update public.minicursos set vagas = 1, ocupadas = 0 where slug = 'ml-na-pratica';
insert into public.organizadores (email) values ('org.acervo@exemplo.com');

-- estrutura e acesso --------------------------------------------------------------------
select has_column('public', 'trabalhos', 'acervo', 'trabalhos.acervo existe');
select col_not_null('public', 'trabalhos', 'acervo', 'acervo nunca é nulo');
select col_default_is('public', 'trabalhos', 'acervo', 'false', 'autorização desmarcada por padrão');
select has_column('public', 'trabalhos', 'acervo_em', 'trabalhos.acervo_em guarda quando autorizou/revogou');
select has_table('public', 'acervo_trabalhos', 'tabela do acervo existe');
select has_table('public', 'pdfs_a_apagar', 'fila de PDFs retirados do acervo existe');
select ok((select relrowsecurity from pg_class where oid = 'public.acervo_trabalhos'::regclass),
  'RLS ligado no acervo');
select ok((select relrowsecurity from pg_class where oid = 'public.pdfs_a_apagar'::regclass),
  'RLS ligado na fila de PDFs');
select is((select count(*)::int from pg_policies where schemaname = 'public'
            and tablename in ('acervo_trabalhos', 'pdfs_a_apagar')), 0,
  'nenhuma policy (deny-by-default): a página pública de edições passadas é feature futura');
select ok(not has_table_privilege('anon', 'public.acervo_trabalhos', 'select'), 'anon NÃO lê o acervo');
select ok(not has_table_privilege('authenticated', 'public.acervo_trabalhos', 'select'),
  'authenticated NÃO lê o acervo direto');
select ok(not has_table_privilege('anon', 'public.pdfs_a_apagar', 'select'), 'anon NÃO lê a fila de PDFs');
select ok(not has_column_privilege('anon', 'public.trabalhos', 'acervo', 'select'), 'anon NÃO lê trabalhos.acervo');
-- acervo sem dados pessoais nem vínculo com a inscrição
select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public' and table_name = 'acervo_trabalhos'
      and column_name in ('cpf', 'email', 'participante_id', 'trabalho_id', 'nome', 'numero',
                          'instituicao', 'vinculo', 'vinculo_outro', 'curso', 'perfil_url')), 0,
  'acervo não tem coluna de CPF, e-mail, nome, inscrição ou perfil');
select is((select count(*)::int from pg_constraint
            where conrelid = 'public.acervo_trabalhos'::regclass and contype = 'f'), 0,
  'acervo não aponta para participantes nem trabalhos (sobrevive ao expurgo final)');
select ok(not has_function_privilege('anon', 'public.admin_definir_acervo(text,boolean)', 'execute'),
  'anon NÃO define acervo');
select ok(has_function_privilege('authenticated', 'public.admin_definir_acervo(text,boolean)', 'execute'),
  'authenticated chama admin_definir_acervo (a função checa organizadores)');
select ok(not has_function_privilege('anon', 'public.admin_retirar_do_acervo(uuid)', 'execute'),
  'anon NÃO retira do acervo');
select ok(has_function_privilege('authenticated', 'public.admin_retirar_do_acervo(uuid)', 'execute'),
  'authenticated chama admin_retirar_do_acervo (a função checa organizadores)');
select ok(not has_function_privilege('anon',
  'public.register_participant(text,text,text,text,smallint[],jsonb,text,text,text,text)', 'execute'),
  'register_participant continua fechado para anon (mesma assinatura)');
select ok(has_function_privilege('service_role',
  'public.register_participant(text,text,text,text,smallint[],jsonb,text,text,text,text)', 'execute'),
  'service_role continua chamando register_participant');

-- inscrição: opt-in gravado a partir de p_trabalho->>'acervo' ------------------------------
create function pg_temp.trab(p_titulo text, p_acervo text) returns jsonb language sql as $$
  select jsonb_build_object('titulo', p_titulo, 'autores', 'Autoria Sintética',
           'resumo', 'Resumo sintético do trabalho para o teste do acervo.', 'premio', false)
         || case when p_acervo is null then '{}'::jsonb else jsonb_build_object('acervo', p_acervo::jsonb) end
$$;
create function pg_temp.inscrever(p_quem text, p_trabalho jsonb) returns table (id_inscricao uuid, numero_inscricao text)
language sql as $$
  select * from public.register_participant('Pessoa ' || initcap(p_quem) || ' Acervo', '529.982.247-25',
    p_quem || '.acervo@exemplo.com', 'UFAL', '{}', p_trabalho, 'estudante', null, null, null)
$$;

create temp table insc as
            select 'oral' as quem, * from pg_temp.inscrever('oral', pg_temp.trab('Trabalho oral', 'true'))
  union all select 'poster', * from pg_temp.inscrever('poster', pg_temp.trab('Trabalho poster', 'true'))
  union all select 'semaut', * from pg_temp.inscrever('semaut', pg_temp.trab('Trabalho sem autorizacao', null))
  union all select 'falso', * from pg_temp.inscrever('falso', pg_temp.trab('Trabalho que recusou', 'false'))
  union all select 'rejeit', * from pg_temp.inscrever('rejeit', pg_temp.trab('Trabalho rejeitado', 'true'))
  union all select 'pend', * from pg_temp.inscrever('pend', pg_temp.trab('Trabalho pendente', 'true'))
  union all select 'cancel', * from pg_temp.inscrever('cancel', pg_temp.trab('Trabalho cancelado', 'true'))
  union all select 'revoga', * from pg_temp.inscrever('revoga', pg_temp.trab('Trabalho revogado', 'true'))
  union all select 'tarde', * from pg_temp.inscrever('tarde', pg_temp.trab('Trabalho autorizado depois', null))
  union all select 'semtrab', * from pg_temp.inscrever('semtrab', null);
create function pg_temp.num(p_quem text) returns text language sql as $$
  select numero_inscricao from insc where quem = p_quem $$;
create function pg_temp.t(p_quem text) returns public.trabalhos language sql as $$
  select t.* from public.trabalhos t join insc i on i.id_inscricao = t.participante_id where i.quem = p_quem $$;

select is((pg_temp.t('oral')).acervo, true, 'opt-in marcado é gravado');
select isnt((pg_temp.t('oral')).acervo_em, null, 'opt-in grava quando a pessoa autorizou');
select is((pg_temp.t('semaut')).acervo, false, 'sem o campo (Edge Function antiga), fica de fora do acervo');
select is((pg_temp.t('semaut')).acervo_em, null, 'sem autorização, nada de data');
select is((pg_temp.t('falso')).acervo, false, 'opt-in desmarcado é gravado como false');
select throws_ok($$ select * from pg_temp.inscrever('ruim', pg_temp.trab('Trabalho ruim', '"talvez"')) $$,
  'P0001', 'TRABALHO_INVALIDO', 'valor de acervo que não é booleano é recusado');

-- controle de vagas (ADR-003) e vínculo continuam iguais
select is(
  (select numero_inscricao is not null from public.register_participant('Caio Minicurso Acervo', '111.444.777-35',
     'caio.acervo@exemplo.com', null, array[(select id from public.minicursos where slug = 'ml-na-pratica')],
     pg_temp.trab('Trabalho com minicurso', 'true'), 'outro', null, null, ' Servidor   técnico ')),
  true, 'inscrição com minicurso, trabalho no acervo e vínculo "Outro" funciona');
select is((select ocupadas from public.minicursos where slug = 'ml-na-pratica'), 1, 'ocupou a única vaga');
select is((select vinculo::text || '|' || vinculo_outro from public.participantes where email = 'caio.acervo@exemplo.com'),
  'outro|Servidor técnico', 'vínculo "Outro" gravado com o texto normalizado');
select throws_ok($$ select * from public.register_participant('Duda Minicurso Acervo', '123.456.789-09',
     'duda.acervo@exemplo.com', null, array[(select id from public.minicursos where slug = 'ml-na-pratica')],
     pg_temp.trab('Trabalho sem vaga', 'true'), 'docente', null, null, null) $$,
  'P0001', 'MINICURSO_ESGOTADO', 'minicurso esgotado continua recusado');
select is((select count(*)::int from public.participantes where email = 'duda.acervo@exemplo.com'), 0,
  'inscrição recusada não deixa participante');
select is((select count(*)::int from public.trabalhos where titulo = 'Trabalho sem vaga'), 0,
  'inscrição recusada não deixa trabalho (mesma transação)');
select throws_ok($$ select * from public.register_participant('Edu Vinculo Acervo', '123.456.789-09',
     'edu.acervo@exemplo.com', null, '{}', pg_temp.trab('Trabalho vinculo', 'true'), 'outro', null, null, null) $$,
  'P0001', 'VINCULO_OUTRO_INVALIDO', '"Outro" sem texto continua recusado');

-- o que a Edge Function e a banca fazem depois
update public.trabalhos t set pdf_path = 'acervo-' || i.quem || '.pdf'
  from insc i where i.id_inscricao = t.participante_id;
update public.trabalhos t set status = s.status::public.status_trabalho
  from insc i, (values ('oral', 'aprovado_oral'), ('poster', 'aprovado_poster'), ('semaut', 'aprovado_oral'),
                       ('falso', 'aprovado_oral'), ('rejeit', 'rejeitado'), ('cancel', 'aprovado_oral'),
                       ('revoga', 'aprovado_oral'), ('tarde', 'aprovado_poster')) as s (quem, status)
 where i.id_inscricao = t.participante_id and i.quem = s.quem;
update public.trabalhos set pdf_path = 'acervo-caio.pdf', status = 'aprovado_oral'
 where titulo = 'Trabalho com minicurso';
update public.participantes p set cancelada_em = now() from insc i where i.id_inscricao = p.id and i.quem = 'cancel';

-- RPC administrativa (autorização recebida por e-mail) ------------------------------------------
select throws_ok($$ select public.admin_definir_acervo(pg_temp.num('tarde'), true) $$,
  'P0001', 'NAO_AUTORIZADO', 'sem login (servidor sem JWT de organizador) é recusado');
set local request.jwt.claims = '{"role":"authenticated","email":"intruso@exemplo.com"}';
select throws_ok($$ select public.admin_definir_acervo(pg_temp.num('tarde'), true) $$,
  'P0001', 'NAO_AUTORIZADO', 'intruso não autoriza acervo');
select throws_ok($$ select public.admin_retirar_do_acervo(gen_random_uuid()) $$,
  'P0001', 'NAO_AUTORIZADO', 'intruso não retira do acervo');
set local request.jwt.claims = '{"role":"authenticated","email":"org.acervo@exemplo.com"}';
select lives_ok($$ select public.admin_definir_acervo(pg_temp.num('tarde'), true) $$,
  'organizador registra a autorização recebida por e-mail');
select is((pg_temp.t('tarde')).acervo, true, 'autorização registrada');
select isnt((pg_temp.t('tarde')).acervo_em, null, 'com a data da autorização');
select lives_ok($$ select public.admin_definir_acervo(pg_temp.num('revoga'), false) $$,
  'organizador registra a revogação');
select is((pg_temp.t('revoga')).acervo, false, 'revogação registrada antes do prazo');
select throws_ok($$ select public.admin_definir_acervo(pg_temp.num('semtrab'), true) $$,
  'P0001', 'SEM_TRABALHO', 'inscrição sem trabalho não entra no acervo');
select throws_ok($$ select public.admin_definir_acervo('ICML26-9999', true) $$,
  'P0001', 'INSCRICAO_INEXISTENTE', 'número inexistente');
select throws_ok($$ select public.admin_definir_acervo(pg_temp.num('cancel'), true) $$,
  'P0001', 'INSCRICAO_CANCELADA', 'inscrição cancelada não passa a autorizar');
select throws_ok($$ select public.admin_definir_acervo(pg_temp.num('tarde'), null) $$,
  'P0001', 'ACERVO_INVALIDO', 'autorização precisa ser sim ou não');
select is((select acervo from public.admin_listar_inscricoes() where numero = pg_temp.num('oral')), true,
  'listagem do painel traz a autorização');
select is((select acervo from public.admin_listar_inscricoes() where numero = pg_temp.num('semtrab')), false,
  'sem trabalho, a listagem mostra false');
reset request.jwt.claims;

-- expurgo de PDFs (31/01/2027): só aprovados + autorizados ficam --------------------------------
select is(public.expurgo_pdfs_pendentes('2027-01-31'), '{}'::text[], 'até o prazo, nenhum PDF a apagar');
select is((public.expurgar_dados('2027-01-31') ->> 'acervo')::int, 0, 'até o prazo, nada vai para o acervo');
select is(public.expurgo_pdfs_pendentes('2027-02-01'),
  array['acervo-cancel.pdf', 'acervo-falso.pdf', 'acervo-pend.pdf', 'acervo-rejeit.pdf', 'acervo-revoga.pdf',
        'acervo-semaut.pdf'],
  'depois do prazo: apaga sem autorização, recusado, rejeitado, pendente, cancelado e revogado');
select is(public.concluir_expurgo_pdfs(public.expurgo_pdfs_pendentes('2027-02-01')), 6, 'marca os 6 como apagados');
select is((public.expurgar_dados('2027-02-01') ->> 'acervo')::int, 4,
  'aprovados + autorizados vão para o acervo (oral, pôster, autorizado depois e o do minicurso)');
select is((public.expurgar_dados('2027-02-02') ->> 'acervo')::int, 0, 'rodar de novo não duplica');
select is((select count(*)::int from public.acervo_trabalhos), 4, '4 trabalhos no acervo');
select set_eq($$ select titulo || '|' || status || '|' || pdf_path || '|' || edicao from public.acervo_trabalhos $$,
  array['Trabalho oral|aprovado_oral|acervo-oral.pdf|2026', 'Trabalho poster|aprovado_poster|acervo-poster.pdf|2026',
        'Trabalho autorizado depois|aprovado_poster|acervo-tarde.pdf|2026',
        'Trabalho com minicurso|aprovado_oral|acervo-caio.pdf|2026'],
  'acervo guarda título, status, PDF e edição');
select is((select autores || '|' || resumo from public.acervo_trabalhos where titulo = 'Trabalho oral'),
  'Autoria Sintética|Resumo sintético do trabalho para o teste do acervo.', 'acervo guarda autores e resumo');
select is((select count(*)::int from public.acervo_trabalhos a
            where row_to_json(a)::text ~ '(52998224725|11144477735|@exemplo\.com|Servidor técnico|ICML26-)'), 0,
  'nenhum CPF, e-mail, vínculo ou nº de inscrição no acervo');
select is((pg_temp.t('oral')).pdf_path, null, 'o PDF sai da inscrição: só o acervo aponta para ele');
select isnt((pg_temp.t('oral')).acervo_id, null, 'a inscrição sabe que está no acervo (para revogar pelo nº)');
select is(public.expurgo_pdfs_pendentes('2027-02-02'), '{}'::text[], 'PDFs do acervo não entram no expurgo');

-- revogação depois do prazo: sai do acervo e o PDF entra na próxima rodada do expurgo -------------
set local request.jwt.claims = '{"role":"authenticated","email":"org.acervo@exemplo.com"}';
select lives_ok($$ select public.admin_definir_acervo(pg_temp.num('poster'), false) $$,
  'organizador registra a revogação depois da transferência');
reset request.jwt.claims;
select is((select count(*)::int from public.acervo_trabalhos where titulo = 'Trabalho poster'), 0,
  'título, autores e resumo saem do acervo na hora');
select is((pg_temp.t('poster')).acervo, false, 'inscrição marcada como não autorizada');
select is(public.expurgo_pdfs_pendentes('2027-02-02'), array['acervo-poster.pdf'],
  'o PDF revogado entra na próxima rodada do expurgo');
select is(public.concluir_expurgo_pdfs(array['acervo-poster.pdf']), 1, 'PDF revogado apagado');
select is(public.expurgo_pdfs_pendentes('2027-02-03'), '{}'::text[], 'fila de PDFs vazia');
set local request.jwt.claims = '{"role":"authenticated","email":"org.acervo@exemplo.com"}';
select throws_ok($$ select public.admin_definir_acervo(pg_temp.num('poster'), true) $$,
  'P0001', 'TRABALHO_SEM_PDF', 'depois que o PDF foi apagado, não volta ao acervo');
select throws_ok($$ select public.admin_definir_acervo(pg_temp.num('semaut'), true) $$,
  'P0001', 'TRABALHO_SEM_PDF', 'autorização tardia sem PDF guardado é recusada');
select lives_ok($$ select public.admin_definir_acervo(pg_temp.num('oral'), true) $$,
  'autorizar de novo quem já está no acervo não muda nada');
reset request.jwt.claims;
select is((select count(*)::int from public.acervo_trabalhos), 3, 'acervo continua com 3');

-- dados pessoais (31/03/2027) e expurgo final (31/12/2031): o acervo sobrevive ------------------
select is((public.expurgar_dados('2027-04-01') ->> 'dados_pessoais')::int, 11, 'CPF e e-mail saem de todos');
select is((select count(*)::int from public.acervo_trabalhos), 3, 'expurgo de dados pessoais não mexe no acervo');
select is((public.expurgar_dados('2032-01-01') ->> 'participantes')::int, 11, 'expurgo final apaga as inscrições');
select is((select count(*)::int from public.trabalhos), 0, 'trabalhos apagados junto com as inscrições');
select is((select count(*)::int from public.acervo_trabalhos), 3, 'acervo sobrevive ao expurgo final');
select is((select count(*)::int from public.acervo_trabalhos where pdf_path is not null), 3, 'com os PDFs');
select is(public.expurgo_pdfs_pendentes('2032-01-02'), '{}'::text[], 'nenhum PDF do acervo a apagar');

-- retirada depois do expurgo final (sem nº de inscrição): pelo id do acervo -----------------------
set local request.jwt.claims = '{"role":"authenticated","email":"org.acervo@exemplo.com"}';
select lives_ok($$ select public.admin_retirar_do_acervo(
    (select id from public.acervo_trabalhos where titulo = 'Trabalho autorizado depois')) $$,
  'organizador retira um trabalho do acervo pelo id');
select throws_ok($$ select public.admin_retirar_do_acervo(gen_random_uuid()) $$,
  'P0001', 'ACERVO_INEXISTENTE', 'id inexistente');
reset request.jwt.claims;
select is((select count(*)::int from public.acervo_trabalhos), 2, 'retirado do acervo');
select is(public.expurgo_pdfs_pendentes('2032-01-02'), array['acervo-tarde.pdf'], 'PDF retirado vai para o expurgo');
select is(public.concluir_expurgo_pdfs(array['acervo-tarde.pdf']), 1, 'e é apagado na rodada seguinte');
select ok(not has_function_privilege('authenticated', 'public.expurgo_pdfs_pendentes(date)', 'execute'),
  'lista de PDFs a apagar continua só para o servidor');

select * from finish();
rollback;
