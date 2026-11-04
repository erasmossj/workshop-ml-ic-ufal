-- Perfil LinkedIn/Lattes obrigatório na inscrição (WML-78). Antes era opcional (WML-69).
-- Inscrições antigas sem perfil continuam válidas; a regra mora nas RPCs, não na coluna.
-- CPFs, e-mails e links sintéticos — nunca use dados reais.
begin;
select plan(26);

update public.config_evento
   set inscricoes_inicio = now() - interval '1 day', inscricoes_fim = now() + interval '1 day',
       submissoes_inicio = now() - interval '1 day', submissoes_fim = now() + interval '1 day';
insert into public.organizadores (email) values ('org.perfil.obrig@exemplo.com');

-- estrutura: assinatura e privilégios iguais, coluna continua aceitando null ------------------
select col_is_null('public', 'participantes', 'perfil_url',
  'perfil_url continua aceitando null (inscrições antigas sem perfil seguem válidas)');
select ok(not has_function_privilege('anon',
  'public.register_participant(text,text,text,text,smallint[],jsonb,text,text,text,text)', 'execute'),
  'anon continua sem chamar register_participant');
select ok(has_function_privilege('service_role',
  'public.register_participant(text,text,text,text,smallint[],jsonb,text,text,text,text)', 'execute'),
  'service_role continua chamando register_participant (Edge Function)');
select ok(not has_function_privilege('anon',
  'public.admin_corrigir_inscricao(text,text,text,text,text,text,text,text,text)', 'execute'),
  'anon continua sem chamar admin_corrigir_inscricao');

-- inscrição: sem perfil é recusada, com perfil passa ------------------------------------------
create function pg_temp.inscrever(p_quem text, p_cpf text, p_perfil text, p_vinculo text default 'estudante')
returns table (id uuid, numero text) language sql as $$
  select * from public.register_participant('Pessoa ' || initcap(p_quem) || ' Obrigatorio', p_cpf,
    p_quem || '.obrig@exemplo.com', 'UFAL', '{}', null, p_vinculo, null, p_perfil,
    case when p_vinculo = 'outro' then 'Servidor' end)
$$;

select throws_ok($$ select * from pg_temp.inscrever('ana', '529.982.247-25', null) $$,
  'P0001', 'PERFIL_OBRIGATORIO', 'sem perfil (null) é recusado');
select throws_ok($$ select * from pg_temp.inscrever('ana', '529.982.247-25', '') $$,
  'P0001', 'PERFIL_OBRIGATORIO', 'perfil vazio é recusado');
select throws_ok($$ select * from pg_temp.inscrever('ana', '529.982.247-25', '   ') $$,
  'P0001', 'PERFIL_OBRIGATORIO', 'perfil só com espaços é recusado');
select throws_ok($$ select * from pg_temp.inscrever('ana', '529.982.247-25', null, 'docente') $$,
  'P0001', 'PERFIL_OBRIGATORIO', 'vale para docente');
select throws_ok($$ select * from pg_temp.inscrever('ana', '529.982.247-25', null, 'outro') $$,
  'P0001', 'PERFIL_OBRIGATORIO', 'vale para "outro"');
select throws_ok($$ select * from public.register_participant('Ana Antiga', '529.982.247-25',
                      'ana.antiga@exemplo.com', null, '{}', null) $$,
  'P0001', 'PERFIL_OBRIGATORIO', 'chamada antiga, sem os parâmetros novos, também é recusada');
select throws_ok($$ select * from pg_temp.inscrever('ana', '529.982.247-25', 'https://exemplo.com/ana') $$,
  'P0001', 'PERFIL_INVALIDO', 'link fora de LinkedIn/Lattes continua PERFIL_INVALIDO');
select is((select count(*)::int from public.participantes where email = 'ana.obrig@exemplo.com'), 0,
  'nenhuma inscrição recusada deixou participante gravado');
select is((select count(*)::int from public.email_outbox o
             join public.participantes p on p.id = o.participante_id
            where p.email like '%.obrig@exemplo.com'), 0,
  'nem e-mail de confirmação na fila');

create temp table insc as
  select 'ana' as quem, * from pg_temp.inscrever('ana', '529.982.247-25', 'linkedin.com/in/ana-obrigatorio')
  union all
  select 'bia', * from pg_temp.inscrever('bia', '111.444.777-35', 'lattes.cnpq.br/1234567890123456', 'outro');
select is((select count(*)::int from insc), 2, 'com perfil LinkedIn ou Lattes a inscrição passa');
select results_eq(
  $$ select perfil_url from public.participantes where email like '%.obrig@exemplo.com' order by email $$,
  $$ values ('https://www.linkedin.com/in/ana-obrigatorio'), ('https://lattes.cnpq.br/1234567890123456') $$,
  'perfil gravado no formato canônico');

-- inscrição antiga, de antes da WML-78, sem perfil (gravada direto na tabela) ----------------
insert into public.participantes (nome, cpf, email, vinculo)
values ('Caio Antigo', '12345678909', 'caio.antigo@exemplo.com', 'estudante');

-- painel: null mantém, '' é recusado ----------------------------------------------------------
set local request.jwt.claims = '{"role":"authenticated","email":"org.perfil.obrig@exemplo.com"}';

select lives_ok($$ select public.admin_corrigir_inscricao(
  (select numero from insc where quem = 'ana'), 'Ana Corrigida', 'ana.obrig@exemplo.com',
  '529.982.247-25', 'UFAL', null, null, null) $$,
  'correção sem perfil (null) continua funcionando');
select is((select perfil_url from public.participantes where email = 'ana.obrig@exemplo.com'),
  'https://www.linkedin.com/in/ana-obrigatorio', 'null mantém o perfil atual');

select throws_ok($$ select public.admin_corrigir_inscricao(
  (select numero from insc where quem = 'ana'), 'Ana Corrigida', 'ana.obrig@exemplo.com',
  '529.982.247-25', 'UFAL', null, null, '') $$,
  'P0001', 'PERFIL_OBRIGATORIO', 'apagar o perfil ('''') é recusado');
select throws_ok($$ select public.admin_corrigir_inscricao(
  (select numero from insc where quem = 'ana'), 'Ana Corrigida', 'ana.obrig@exemplo.com',
  '529.982.247-25', 'UFAL', null, null, '   ') $$,
  'P0001', 'PERFIL_OBRIGATORIO', 'perfil só com espaços também é recusado na correção');
select throws_ok($$ select public.admin_corrigir_inscricao(
  (select numero from insc where quem = 'ana'), 'Ana Corrigida', 'ana.obrig@exemplo.com',
  '529.982.247-25', 'UFAL', null, null, 'https://exemplo.com/ana') $$,
  'P0001', 'PERFIL_INVALIDO', 'link fora de LinkedIn/Lattes continua PERFIL_INVALIDO na correção');
select is((select perfil_url from public.participantes where email = 'ana.obrig@exemplo.com'),
  'https://www.linkedin.com/in/ana-obrigatorio', 'correção recusada não mexe no perfil');

select lives_ok($$ select public.admin_corrigir_inscricao(
  (select numero from public.participantes where email = 'caio.antigo@exemplo.com'), 'Caio Antigo',
  'caio.antigo@exemplo.com', '123.456.789-09', 'UFAL') $$,
  'inscrição antiga sem perfil continua corrigível sem informar perfil');
select is((select perfil_url from public.participantes where email = 'caio.antigo@exemplo.com'),
  null, 'e continua sem perfil (válida)');
select throws_ok($$ select public.admin_corrigir_inscricao(
  (select numero from public.participantes where email = 'caio.antigo@exemplo.com'), 'Caio Antigo',
  'caio.antigo@exemplo.com', '123.456.789-09', 'UFAL', null, null, '') $$,
  'P0001', 'PERFIL_OBRIGATORIO', 'nem na inscrição antiga o painel grava perfil vazio');
select lives_ok($$ select public.admin_corrigir_inscricao(
  (select numero from public.participantes where email = 'caio.antigo@exemplo.com'), 'Caio Antigo',
  'caio.antigo@exemplo.com', '123.456.789-09', 'UFAL', null, null, 'linkedin.com/in/caio-antigo') $$,
  'a organização pode completar o perfil de uma inscrição antiga');
select is((select perfil_url from public.participantes where email = 'caio.antigo@exemplo.com'),
  'https://www.linkedin.com/in/caio-antigo', 'perfil completado no formato canônico');
reset request.jwt.claims;

select * from finish();
rollback;
