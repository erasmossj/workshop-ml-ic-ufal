-- E-mail único entre inscrições ATIVAS (WML-67): cancelou, a pessoa pode se inscrever de novo.
-- CPFs e e-mails sintéticos — nunca use dados reais.
begin;
select plan(8);

update public.config_evento
   set inscricoes_inicio = now() - interval '1 day', inscricoes_fim = now() + interval '1 day';
insert into public.organizadores (email) values ('org@exemplo.com');

create temp table insc as
  select 'ana' as quem, * from public.register_participant('Ana Reinscrição', '529.982.247-25', 'ana.reinscricao@exemplo.com', null, '{}', null)
  union all
  select 'bia', * from public.register_participant('Bia Reinscrição', '111.444.777-35', 'bia.reinscricao@exemplo.com', null, '{}', null);

select has_index('public', 'participantes', 'participantes_email_ativo_key', 'índice único só das inscrições ativas');

select throws_ok($$ select * from public.register_participant('Ana Outra Vez', '529.982.247-25', 'ana.reinscricao@exemplo.com', null, '{}', null) $$,
  'P0001', 'EMAIL_JA_INSCRITO', 'inscrição ativa continua bloqueando o mesmo e-mail');

set local request.jwt.claims = '{"role":"service_role"}';
select public.cancel_registration((select id_inscricao from insc where quem = 'ana'));
reset request.jwt.claims;

select lives_ok($$ insert into insc select 'ana2', * from public.register_participant('Ana Reinscrição', '529.982.247-25',
  ' Ana.Reinscricao@Exemplo.com ', null, '{}', null) $$, 'depois de cancelar, o mesmo e-mail se inscreve de novo');
select isnt((select numero_inscricao from insc where quem = 'ana2'), (select numero_inscricao from insc where quem = 'ana'),
  'a nova inscrição ganha um número novo');
select is((select count(*)::int from public.participantes where email = 'ana.reinscricao@exemplo.com'), 2,
  'a cancelada fica no histórico');
select is((select count(*)::int from public.participantes where email = 'ana.reinscricao@exemplo.com' and cancelada_em is null), 1,
  'só uma ativa por e-mail');
select throws_ok($$ select * from public.register_participant('Ana Terceira', '529.982.247-25', 'ana.reinscricao@exemplo.com', null, '{}', null) $$,
  'P0001', 'EMAIL_JA_INSCRITO', 'a nova inscrição ativa volta a bloquear o e-mail');

set local request.jwt.claims = '{"role":"authenticated","email":"org@exemplo.com"}';
select throws_ok($$ select public.admin_corrigir_inscricao((select numero_inscricao from insc where quem = 'bia'),
  'Bia Reinscrição', 'ana.reinscricao@exemplo.com', '111.444.777-35', null) $$, 'P0001', 'EMAIL_JA_INSCRITO',
  'correção não pode usar o e-mail de outra inscrição ativa');

select * from finish();
rollback;
