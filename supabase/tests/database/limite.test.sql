-- Limite de requisições por IP (threat model: robôs/flood). A chave é um hash — nunca o IP.
begin;
select plan(7);

select ok(not has_function_privilege('anon', 'public.consumir_limite(text,integer,integer)', 'execute'),
  'anon NÃO executa consumir_limite');
select ok(has_function_privilege('service_role', 'public.consumir_limite(text,integer,integer)', 'execute'),
  'service_role executa consumir_limite');

select is(public.consumir_limite('hash-teste', 3, 600), true, '1ª requisição permitida');
select is(public.consumir_limite('hash-teste', 3, 600), true, '2ª requisição permitida');
select is(public.consumir_limite('hash-teste', 3, 600), true, '3ª requisição permitida');
select is(public.consumir_limite('hash-teste', 3, 600), false, '4ª requisição na mesma janela é bloqueada');
select is(public.consumir_limite('outro-hash', 3, 600), true, 'outra origem tem seu próprio limite');

select * from finish();
rollback;
