-- Fila de e-mail (WML-29): reserva com teto diário, retries com espera crescente e privilégios.
-- CPFs e e-mails sintéticos — nunca use dados reais.
begin;
select plan(24);

update public.config_evento
   set inscricoes_inicio = now() - interval '1 day',
       inscricoes_fim    = now() + interval '1 day',
       submissoes_inicio = now() - interval '1 day',
       submissoes_fim    = now() + interval '1 day',
       limite_diario_email = 3;

-- Isola o teste das linhas que já estejam na fila local.
delete from public.email_outbox;

insert into public.minicursos (id, slug, titulo, vagas) values (92, 'teste-fila', 'Minicurso da fila', 10);

select * from public.register_participant('Ana Fila', '529.982.247-25', 'ana.fila@exemplo.com', null, '{92}',
  '{"titulo": "Redes neurais na prática", "autores": "Ana Fila", "resumo": "Resumo sintético do trabalho.", "premio": false}');
select * from public.register_participant('Bia Fila', '111.444.777-35', 'bia.fila@exemplo.com', null, '{}', null);
select * from public.register_participant('Caio Fila', '529.982.247-25', 'caio.fila@exemplo.com', null, '{}', null);
select * from public.register_participant('Davi Fila', '111.444.777-35', 'davi.fila@exemplo.com', null, '{}', null);

-- privilégios ---------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.reservar_emails(integer)', 'execute'),
  'anon NÃO reserva e-mails');
select ok(not has_function_privilege('authenticated', 'public.reservar_emails(integer)', 'execute'),
  'authenticated NÃO reserva e-mails');
select ok(has_function_privilege('service_role', 'public.reservar_emails(integer)', 'execute'),
  'service_role reserva e-mails');
select ok(not has_function_privilege('anon', 'public.concluir_email(bigint,boolean,text,text)', 'execute'),
  'anon NÃO conclui e-mails');
select ok(not has_function_privilege('authenticated', 'public.concluir_email(bigint,boolean,text,text)', 'execute'),
  'authenticated NÃO conclui e-mails');
select ok(not has_function_privilege('anon', 'public.disparar_envio_emails()', 'execute'),
  'anon NÃO dispara o envio');
select ok(not has_function_privilege('authenticated', 'public.disparar_envio_emails()', 'execute'),
  'authenticated NÃO dispara o envio');

-- reserva ---------------------------------------------------------------------------
create temp table lote1 as select * from public.reservar_emails(2);

select is((select count(*)::int from lote1), 2, 'reserva respeita o tamanho do lote');
select is((select email from lote1 order by id limit 1), 'ana.fila@exemplo.com', 'reserva na ordem de chegada');
select is((select cpf_mascarado from lote1 where email = 'ana.fila@exemplo.com'), '***.982.247-**',
  'CPF sai mascarado');
select is((select minicurso from lote1 where email = 'ana.fila@exemplo.com'), 'Minicurso da fila',
  'traz o título do minicurso');
select is((select trabalho from lote1 where email = 'ana.fila@exemplo.com'), 'Redes neurais na prática',
  'traz o título do trabalho');
select is((select count(*)::int from public.email_outbox where status = 'enviando' and tentativas = 1), 2,
  'itens reservados ficam "enviando" com a tentativa contada');

-- teto diário: 3 por dia; 2 já estão em envio --------------------------------------
select is((select count(*)::int from public.reservar_emails(10)), 1, 'teto diário conta os itens em envio');
select is((select count(*)::int from public.reservar_emails(10)), 0, 'teto diário atingido: nada é reservado');

-- conclusão com sucesso -------------------------------------------------------------
select public.concluir_email(id, true, 'gmail', null) from lote1;
select is((select count(*)::int from public.email_outbox where status = 'enviado' and provedor = 'gmail'
           and enviado_em is not null), 2, 'sucesso marca enviado, com provedor e data');
select is((select count(*)::int from public.reservar_emails(10)), 0, 'enviados de hoje continuam contando no teto');

-- falha: volta para a fila com espera crescente, sem dado pessoal no erro --------------
update public.config_evento set limite_diario_email = 100;
create temp table falho as
  select o.id from public.email_outbox o join public.participantes p on p.id = o.participante_id
   where p.email = 'caio.fila@exemplo.com';
select public.concluir_email((select id from falho), false, null,
  '550 5.1.1 caixa inexistente: caio.fila@exemplo.com');
select is((select status from public.email_outbox where id = (select id from falho)), 'pendente',
  'falha temporária volta para a fila');
select ok((select proxima_tentativa > now() + interval '1 minute' from public.email_outbox
           where id = (select id from falho)), 'próxima tentativa só depois de uma espera');
select is((select ultimo_erro from public.email_outbox where id = (select id from falho)),
  '550 5.1.1 caixa inexistente: [e-mail]', 'erro guardado sem o endereço de e-mail');
select ok(not exists (select 1 from public.reservar_emails(10) r where r.id = (select id from falho)),
  'item em espera não é reservado antes da hora');

-- 5ª tentativa sem sucesso: desiste ----------------------------------------------------
update public.email_outbox set status = 'enviando', tentativas = 5 where id = (select id from falho);
select public.concluir_email((select id from falho), false, null, 'timeout');
select is((select status from public.email_outbox where id = (select id from falho)), 'falhou',
  'depois de 5 tentativas o item é marcado como falhou');

-- reserva travada (função caiu no meio) volta para a fila ------------------------------
update public.email_outbox set status = 'enviando', reservado_em = now() - interval '20 minutes', tentativas = 1
 where id = (select id from falho);
select ok(exists (select 1 from public.reservar_emails(10) r where r.id = (select id from falho)),
  'reserva esquecida há mais de 10 minutos é retomada');

-- inscrição cancelada não recebe e-mail -------------------------------------------------
update public.email_outbox set status = 'pendente', reservado_em = null;
update public.participantes set cancelada_em = now() where email = 'davi.fila@exemplo.com';
select ok(not exists (select 1 from public.reservar_emails(10) r where r.email = 'davi.fila@exemplo.com'),
  'inscrição cancelada não é reservada');

select * from finish();
rollback;
