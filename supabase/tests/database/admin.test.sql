-- Painel da organização (WML-32..35): só organizadores, CPF sempre mascarado, vagas pelas RPCs.
-- CPFs e e-mails sintéticos — nunca use dados reais.
begin;
select plan(36);

update public.config_evento
   set inscricoes_inicio = now() - interval '1 day', inscricoes_fim = now() + interval '1 day',
       submissoes_inicio = now() - interval '1 day', submissoes_fim = now() + interval '1 day';
insert into public.minicursos (id, slug, titulo, vagas) values (93, 'teste-admin', 'Minicurso admin', 3);
insert into public.organizadores (email) values ('org@exemplo.com');

create temp table insc as
  select 'ana' as quem, * from public.register_participant('Ana Admin', '529.982.247-25', 'ana.admin@exemplo.com',
    null, '{93}', '{"titulo": "Trabalho da Ana", "autores": "Ana", "resumo": "Resumo sintético do trabalho.", "premio": false}')
  union all
  select 'bia', * from public.register_participant('Bia Admin', '111.444.777-35', 'bia.admin@exemplo.com', null, '{93}', null)
  union all
  select 'caio', * from public.register_participant('Caio Admin', '529.982.247-25', 'caio.admin@exemplo.com', null, '{}', null)
  union all
  select 'davi', * from public.register_participant('Davi Admin', '123.456.789-09', 'davi.admin@exemplo.com', null, '{93}', null);
update public.trabalhos set pdf_path = 'teste-admin.pdf'
 where participante_id = (select id_inscricao from insc where quem = 'ana');
insert into storage.objects (bucket_id, name) values ('trabalhos', 'teste-admin.pdf');

-- privilégios: anon não executa nada do painel -------------------------------------
select ok(not has_function_privilege('anon', 'public.admin_cancelar_inscricao(text)', 'execute'), 'anon NÃO cancela');
select ok(not has_function_privilege('anon', 'public.admin_corrigir_inscricao(text,text,text,text,text)', 'execute'),
  'anon NÃO corrige');
select ok(not has_function_privilege('anon', 'public.admin_reenviar_confirmacao(text)', 'execute'), 'anon NÃO reenvia');
select ok(not has_function_privilege('anon', 'public.admin_obter_config()', 'execute'), 'anon NÃO lê a configuração');
select ok(not has_function_privilege('anon', 'public.admin_definir_janelas(timestamptz,timestamptz,timestamptz,timestamptz,integer)', 'execute'),
  'anon NÃO altera janelas');
select ok(not has_function_privilege('anon', 'public.admin_resumo_emails()', 'execute'), 'anon NÃO vê a fila');

-- autenticado que não é organizador é recusado em tudo -----------------------------
set local request.jwt.claims = '{"role":"authenticated","email":"intruso@exemplo.com"}';
select throws_ok($$ select public.admin_cancelar_inscricao((select numero_inscricao from insc where quem = 'bia')) $$,
  'P0001', 'NAO_AUTORIZADO', 'intruso não cancela');
select throws_ok($$ select public.admin_corrigir_inscricao((select numero_inscricao from insc where quem = 'bia'),
  'Bia Hacker', 'x@exemplo.com', '111.444.777-35', null) $$, 'P0001', 'NAO_AUTORIZADO', 'intruso não corrige');
select throws_ok($$ select public.admin_reenviar_confirmacao((select numero_inscricao from insc where quem = 'bia')) $$,
  'P0001', 'NAO_AUTORIZADO', 'intruso não reenvia');
select throws_ok('select public.admin_obter_config()', 'P0001', 'NAO_AUTORIZADO', 'intruso não lê a configuração');
select throws_ok($$ select public.admin_definir_janelas(now(), now() + interval '1 day', now(), now() + interval '1 day', 100) $$,
  'P0001', 'NAO_AUTORIZADO', 'intruso não altera janelas');
select throws_ok('select public.admin_resumo_emails()', 'P0001', 'NAO_AUTORIZADO', 'intruso não vê a fila');
select throws_ok($$ select public.admin_definir_status_trabalho((select numero_inscricao from insc where quem = 'ana'),
  'aprovado_oral') $$, 'P0001', 'NAO_AUTORIZADO', 'intruso não avalia trabalho');
select throws_ok($$ select public.admin_definir_vagas(93::smallint, 1000) $$, 'P0001', 'NAO_AUTORIZADO',
  'intruso não altera vagas');
select throws_ok($$ select public.cancel_registration((select id_inscricao from insc where quem = 'bia')) $$,
  'P0001', 'NAO_AUTORIZADO', 'intruso não cancela pela RPC de servidor');

set local role authenticated;
select is((select count(*)::int from storage.objects where bucket_id = 'trabalhos'), 0,
  'intruso não enxerga os PDFs dos trabalhos');
reset role;

-- organizador -------------------------------------------------------------------------
set local request.jwt.claims = '{"role":"authenticated","email":"org@exemplo.com"}';

set local role authenticated;
select is((select count(*)::int from storage.objects where bucket_id = 'trabalhos' and name = 'teste-admin.pdf'), 1,
  'organizador enxerga o PDF (para gerar URL assinada)');
reset role;

select is((select pdf_path from public.admin_listar_inscricoes() where email = 'ana.admin@exemplo.com'),
  'teste-admin.pdf', 'listagem traz o caminho do PDF');
select is((select email_status from public.admin_listar_inscricoes() where email = 'ana.admin@exemplo.com'),
  'pendente', 'listagem traz a situação do e-mail de confirmação');

-- cancelar libera a vaga
select public.admin_cancelar_inscricao((select numero_inscricao from insc where quem = 'bia'));
select is((select ocupadas from public.minicursos where id = 93), 2, 'cancelar libera a vaga do minicurso');
select is((select cancelada from public.admin_listar_inscricoes() where email = 'bia.admin@exemplo.com'), true,
  'inscrição aparece como cancelada');
select throws_ok($$ select public.admin_cancelar_inscricao('ICML26-9999') $$, 'P0001', 'INSCRICAO_INEXISTENTE',
  'número inexistente é recusado');

-- corrigir dados
select public.admin_corrigir_inscricao((select numero_inscricao from insc where quem = 'caio'),
  '  Caio  Corrigido ', ' CAIO.NOVO@Exemplo.com ', '111.444.777-35', 'UFAL');
select is((select nome || '|' || email || '|' || cpf_mascarado || '|' || instituicao from public.admin_listar_inscricoes()
           where numero = (select numero_inscricao from insc where quem = 'caio')),
  'Caio Corrigido|caio.novo@exemplo.com|***.444.777-**|UFAL', 'corrige nome, e-mail, CPF e instituição (normalizados)');
select throws_ok($$ select public.admin_corrigir_inscricao((select numero_inscricao from insc where quem = 'caio'),
  'Caio Corrigido', 'ana.admin@exemplo.com', '111.444.777-35', null) $$, 'P0001', 'EMAIL_JA_INSCRITO',
  'não deixa usar o e-mail de outra inscrição');
select throws_ok($$ select public.admin_corrigir_inscricao((select numero_inscricao from insc where quem = 'caio'),
  'Caio Corrigido', 'caio.novo@exemplo.com', '111.444.777-36', null) $$, 'P0001', 'CPF_INVALIDO',
  'valida o CPF');
select throws_ok($$ select public.admin_corrigir_inscricao((select numero_inscricao from insc where quem = 'caio'),
  'Caio', 'caio.novo@exemplo.com', '111.444.777-35', null) $$, 'P0001', 'NOME_INVALIDO', 'valida o nome');
select throws_ok($$ select public.admin_corrigir_inscricao((select numero_inscricao from insc where quem = 'bia'),
  'Bia Admin', 'bia.admin@exemplo.com', '111.444.777-35', null) $$, 'P0001', 'INSCRICAO_CANCELADA',
  'não corrige inscrição cancelada');
select throws_ok($$ select public.admin_corrigir_inscricao((select numero_inscricao from insc where quem = 'ana'),
  'Ana Admin', 'ana.admin@exemplo.com', '123.456.789-09', null) $$, 'P0001', 'CPF_JA_NO_MINICURSO',
  'não deixa o mesmo CPF ocupar duas vagas no minicurso');

-- reenviar confirmação
update public.email_outbox set status = 'falhou'
 where participante_id = (select id_inscricao from insc where quem = 'caio');
select public.admin_reenviar_confirmacao((select numero_inscricao from insc where quem = 'caio'));
select public.admin_reenviar_confirmacao((select numero_inscricao from insc where quem = 'caio'));
select is((select count(*)::int from public.email_outbox
            where participante_id = (select id_inscricao from insc where quem = 'caio') and status = 'pendente'), 1,
  'reenviar põe um novo e-mail na fila (sem duplicar se já houver um pendente)');

-- configuração do evento
select is((public.admin_obter_config() -> 'minicursos' -> 0 ->> 'slug') is not null, true,
  'configuração traz os minicursos');
select is((select (m ->> 'ocupadas')::int from jsonb_array_elements(public.admin_obter_config() -> 'minicursos') m
            where m ->> 'slug' = 'teste-admin'), 2, 'configuração traz as vagas ocupadas');
select throws_ok($$ select public.admin_definir_janelas(now() + interval '2 days', now(), now(), now() + interval '1 day', 100) $$,
  'P0001', 'JANELAS_INVALIDAS', 'início depois do fim é recusado');
select lives_ok($$ select public.admin_definir_janelas('2026-10-30 00:00-03', '2026-11-18 23:59:59-03',
  '2026-10-30 00:00-03', '2026-11-18 23:59:59-03', 400) $$, 'prorroga as janelas e muda o teto de e-mail');
select is((public.admin_obter_config() ->> 'limite_diario_email')::int, 400, 'novo teto de e-mail salvo');
select throws_ok($$ select public.admin_definir_vagas(93::smallint, 1) $$, 'P0001', 'VAGAS_ABAIXO_DAS_OCUPADAS',
  'não reduz vagas abaixo das ocupadas');

-- fila de e-mail
select is((public.admin_resumo_emails() ->> 'pendente')::int >= 1, true, 'resumo da fila conta os pendentes');

select * from finish();
rollback;
