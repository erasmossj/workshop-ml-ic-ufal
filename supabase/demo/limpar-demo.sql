-- Remove os dados de DEMONSTRAÇÃO (popular-demo.sql) e religa o envio de e-mails (WML-40).
-- SOMENTE staging ou local. Cole no SQL Editor do STAGING e rode depois da apresentação.
--
-- Cancela pelas regras do sistema (libera as vagas do minicurso) e apaga as pessoas fictícias;
-- presenças, trabalhos, certificados e e-mails na fila delas saem junto (on delete cascade).

do $$
declare
  v_url text;
  v_id uuid;
begin
  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'send_emails_url';
  if v_url is null or v_url like '%sjzyipebykiaiasdafai%'
     or not (v_url like 'https://aiyzqeckoyalrhlvhmmf.supabase.co/%' or v_url like 'http://kong:8000/%') then
    raise exception 'Recusado: a limpeza da demonstração só roda no staging ou no banco local.';
  end if;

  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  for v_id in
    select p.id from public.participantes p
     where p.email like 'demo-%@exemplo.com' and p.cancelada_em is null
  loop
    perform public.cancel_registration(v_id);
  end loop;

  delete from public.participantes p where p.email like 'demo-%@exemplo.com';
end $$;

-- Religa o envio de e-mails (caso tenha sido pausado antes de "Liberar certificados").
select cron.alter_job((select jobid from cron.job where jobname = 'enviar-emails'), active := true);
