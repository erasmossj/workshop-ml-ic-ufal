-- Regras de negócio da inscrição (ADR-003). CPFs sintéticos — nunca use dados reais.
begin;
select plan(24);

update public.config_evento
   set inscricoes_inicio = now() - interval '1 day',
       inscricoes_fim    = now() + interval '1 day',
       submissoes_inicio = now() - interval '1 day',
       submissoes_fim    = now() + interval '1 day';

insert into public.minicursos (id, slug, titulo, vagas)
values (90, 'teste-1-vaga', 'Minicurso de teste', 1),
       (91, 'teste-fechado', 'Minicurso sem vagas definidas', null);

-- inscrição simples ---------------------------------------------------------
select lives_ok(
  $$ select * from public.register_participant('Ana Teste', '529.982.247-25', '  Ana@Exemplo.com ', null, '{}', null) $$,
  'inscrição simples funciona');
select is((select count(*)::int from public.participantes where email = 'ana@exemplo.com'), 1,
  'e-mail salvo normalizado (minúsculas, sem espaços)');
select is((select cpf from public.participantes where email = 'ana@exemplo.com'), '52998224725',
  'CPF salvo só com dígitos');
select matches((select numero from public.participantes where email = 'ana@exemplo.com'), '^ICML26-\d{4}$',
  'número de inscrição no formato ICML26-0000');
select is((select count(*)::int from public.email_outbox o join public.participantes p on p.id = o.participante_id
           where p.email = 'ana@exemplo.com' and o.tipo = 'confirmacao' and o.status = 'pendente'), 1,
  'e-mail de confirmação enfileirado');

-- unicidade -------------------------------------------------------------------
select throws_ok(
  $$ select * from public.register_participant('Ana Outra', '11144477735', 'ANA@exemplo.com', null, '{}', null) $$,
  'P0001', 'EMAIL_JA_INSCRITO', 'e-mail repetido (qualquer caixa) é recusado');
select lives_ok(
  $$ select * from public.register_participant('Ana Teste', '52998224725', 'ana2@exemplo.com', null, '{}', null) $$,
  'mesmo CPF com outro e-mail é aceito');

-- validações no banco (não confia no front) -----------------------------------
select throws_ok(
  $$ select * from public.register_participant('Bia Teste', '529.982.247-24', 'bia@exemplo.com', null, '{}', null) $$,
  'P0001', 'CPF_INVALIDO', 'CPF com dígito verificador errado é recusado');
select throws_ok(
  $$ select * from public.register_participant('Bia', '39053344705', 'bia@exemplo.com', null, '{}', null) $$,
  'P0001', 'NOME_INVALIDO', 'nome sem sobrenome é recusado');
select throws_ok(
  $$ select * from public.register_participant('Bia Teste', '39053344705', 'bia-sem-arroba', null, '{}', null) $$,
  'P0001', 'EMAIL_INVALIDO', 'e-mail malformado é recusado');

-- vagas do minicurso ----------------------------------------------------------
select lives_ok(
  $$ select * from public.register_participant('Caio Teste', '11144477735', 'caio@exemplo.com', null, '{90}', null) $$,
  'ocupa a última vaga');
select is((select ocupadas from public.minicursos where id = 90), 1, 'contador de vagas incrementado');
select throws_ok(
  $$ select * from public.register_participant('Davi Teste', '39053344705', 'davi@exemplo.com', null, '{90}', null) $$,
  'P0001', 'MINICURSO_ESGOTADO', 'minicurso esgotado bloqueia nova inscrição nele');
select is((select count(*)::int from public.participantes where email = 'davi@exemplo.com'), 0,
  'inscrição recusada é desfeita por inteiro (sem participante órfão)');
select throws_ok(
  $$ select * from public.register_participant('Davi Teste', '39053344705', 'davi@exemplo.com', null, '{91}', null) $$,
  'P0001', 'MINICURSO_FECHADO', 'minicurso sem vagas definidas não aceita inscrição');

update public.minicursos set vagas = 5 where id = 90;
select throws_ok(
  $$ select * from public.register_participant('Caio Teste', '11144477735', 'caio2@exemplo.com', null, '{90}', null) $$,
  'P0001', 'CPF_JA_NO_MINICURSO', 'mesmo CPF não ocupa duas vagas no mesmo minicurso');

-- trabalho --------------------------------------------------------------------
select lives_ok(
  $$ select * from public.register_participant('Eva Teste', '10000000019', 'eva@exemplo.com', 'UFAL', '{}',
       '{"titulo":"Redes neurais em imagens","autores":"Eva Teste","resumo":"Resumo do trabalho de teste.","premio":true,"nivel":"graduacao"}') $$,
  'inscrição com trabalho');
select is((select t.status::text from public.trabalhos t join public.participantes p on p.id = t.participante_id
           where p.email = 'eva@exemplo.com'), 'pendente', 'trabalho começa pendente');
select throws_ok(
  $$ select * from public.register_participant('Gil Teste', '20000000027', 'gil@exemplo.com', null, '{}',
       '{"titulo":"Título qualquer","autores":"Gil Teste","resumo":"Resumo do trabalho de teste.","premio":true}') $$,
  'P0001', 'NIVEL_OBRIGATORIO', 'concorrer ao prêmio exige a categoria');

update public.config_evento set submissoes_fim = now() - interval '1 minute';
select throws_ok(
  $$ select * from public.register_participant('Gil Teste', '20000000027', 'gil@exemplo.com', null, '{}',
       '{"titulo":"Título qualquer","autores":"Gil Teste","resumo":"Resumo do trabalho de teste.","premio":false}') $$,
  'P0001', 'SUBMISSOES_FECHADAS', 'trabalho fora da janela de submissão é recusado');

update public.config_evento set inscricoes_fim = now() - interval '1 minute';
select throws_ok(
  $$ select * from public.register_participant('Hugo Teste', '30000000035', 'hugo@exemplo.com', null, '{}', null) $$,
  'P0001', 'INSCRICOES_FECHADAS', 'inscrição fora da janela é recusada');

-- cancelamento (servidor) libera a vaga ----------------------------------------
set local request.jwt.claims = '{"role":"service_role"}';
select lives_ok(
  $$ select public.cancel_registration((select id from public.participantes where email = 'caio@exemplo.com')) $$,
  'organização/servidor cancela inscrição');
select is((select ocupadas from public.minicursos where id = 90), 0, 'cancelamento libera a vaga');

-- máscara ---------------------------------------------------------------------
select is(public.mascarar_cpf('52998224725'), '***.982.247-**', 'máscara do CPF no padrão gov.br');

select * from finish();
rollback;
