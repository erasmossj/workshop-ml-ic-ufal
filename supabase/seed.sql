-- Dados SÓ do ambiente local (supabase db reset). Nunca coloque dados reais aqui.
insert into public.organizadores (email) values ('organizacao@exemplo.com');

-- Liga o pg_cron à Edge Function local (http://kong:8000 é o gateway visto de dentro do Docker).
-- O segredo é o mesmo de supabase/functions/.env.example — vale SÓ para o ambiente local.
select vault.create_secret('http://kong:8000/functions/v1/send-emails', 'send_emails_url');
select vault.create_secret('segredo-local-do-cron-de-desenvolvimento-0001', 'send_emails_secret');
