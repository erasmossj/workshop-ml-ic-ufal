-- Fila de e-mail (WML-29 · ADR-001: Gmail com teto diário, Brevo de reserva).
-- pg_cron chama a Edge Function `send-emails` a cada minuto (só quando há algo para enviar);
-- a função reserva um lote aqui, envia e informa o resultado. Retries com espera crescente.
-- URL e segredo da chamada ficam no Vault (nunca no repositório):
--   select vault.create_secret('<url>/functions/v1/send-emails', 'send_emails_url');
--   select vault.create_secret('<mesmo valor de SEND_EMAILS_SECRET>', 'send_emails_secret');

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.email_outbox
  add column proxima_tentativa timestamptz not null default now(),
  add column reservado_em timestamptz,
  add column provedor text check (provedor in ('gmail', 'brevo'));

drop index public.email_outbox_fila_idx;
create index email_outbox_fila_idx on public.email_outbox (status, proxima_tentativa);

-- Tira dado pessoal de mensagens de erro do provedor antes de guardar (LGPD).
create function public.erro_sem_dados_pessoais(p_erro text) returns text
language sql immutable set search_path = '' as $$
  select left(
    regexp_replace(
      regexp_replace(coalesce(p_erro, 'erro desconhecido'), '[^\s<>()"'']+@[^\s<>()"'']+', '[e-mail]', 'g'),
      '\d{3}\.?\d{3}\.?\d{3}-?\d{2}', '[cpf]', 'g'),
    300)
$$;

-- Reserva até p_lote e-mails, respeitando o teto diário (dia de Maceió) de config_evento.
-- Os itens voltam com o CPF já mascarado.
create function public.reservar_emails(p_lote integer)
returns table (
  id bigint, tipo text, tentativas smallint, numero text, nome text, email text,
  cpf_mascarado text, minicurso text, trabalho text
)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
declare
  v_inicio_dia timestamptz :=
    date_trunc('day', now() at time zone 'America/Maceio') at time zone 'America/Maceio';
  v_livres integer;
begin
  -- Uma reserva por vez: duas execuções simultâneas não furam o teto.
  perform pg_advisory_xact_lock(hashtext('public.reservar_emails'));

  -- Reserva esquecida (a função caiu no meio do envio) volta para a fila.
  update public.email_outbox o
     set status = case when o.tentativas >= 5 then 'falhou' else 'pendente' end,
         reservado_em = null,
         proxima_tentativa = now()
   where o.status = 'enviando' and o.reservado_em < now() - interval '10 minutes';

  -- Inscrição cancelada não recebe e-mail.
  update public.email_outbox o
     set status = 'falhou', ultimo_erro = 'INSCRICAO_CANCELADA'
    from public.participantes p
   where p.id = o.participante_id and o.status = 'pendente' and p.cancelada_em is not null;

  select c.limite_diario_email - (
           select count(*) from public.email_outbox o
            where o.status = 'enviando' or (o.status = 'enviado' and o.enviado_em >= v_inicio_dia))
    into v_livres
    from public.config_evento c
   where c.id;
  if coalesce(v_livres, 0) <= 0 or p_lote <= 0 then
    return;
  end if;

  return query
  with alvo as (
    select o.id
      from public.email_outbox o
      join public.participantes p on p.id = o.participante_id
     where o.status = 'pendente' and o.proxima_tentativa <= now() and p.cancelada_em is null
     order by o.criado_em, o.id
     limit least(p_lote, v_livres)
     for update of o skip locked
  ), reservado as (
    update public.email_outbox o
       set status = 'enviando', tentativas = o.tentativas + 1, reservado_em = now()
      from alvo
     where o.id = alvo.id
    returning o.id, o.tipo, o.tentativas, o.participante_id
  )
  select r.id, r.tipo, r.tentativas, p.numero, p.nome, p.email, public.mascarar_cpf(p.cpf),
         (select string_agg(m.titulo, ', ' order by m.id)
            from public.inscricoes_minicurso i
            join public.minicursos m on m.id = i.minicurso_id
           where i.participante_id = p.id),
         (select t.titulo from public.trabalhos t where t.participante_id = p.id)
    from reservado r
    join public.participantes p on p.id = r.participante_id
   order by r.id;
end $$;

-- Resultado do envio. Falha: espera 2, 4, 8, 16 min; na 5ª tentativa, desiste ("falhou").
create function public.concluir_email(p_id bigint, p_sucesso boolean, p_provedor text, p_erro text)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_sucesso then
    update public.email_outbox o
       set status = 'enviado', enviado_em = now(), provedor = p_provedor,
           ultimo_erro = null, reservado_em = null
     where o.id = p_id and o.status = 'enviando';
  else
    update public.email_outbox o
       set status = case when o.tentativas >= 5 then 'falhou' else 'pendente' end,
           proxima_tentativa = now() + make_interval(mins => power(2, o.tentativas)::integer),
           ultimo_erro = public.erro_sem_dados_pessoais(p_erro),
           reservado_em = null
     where o.id = p_id and o.status = 'enviando';
  end if;
end $$;

-- Chamado pelo pg_cron: acorda a Edge Function só se houver e-mail pronto para sair.
-- Sem os segredos no Vault (ex.: ambiente recém-criado), não faz nada.
create function public.disparar_envio_emails() returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  v_url text;
  v_segredo text;
begin
  if not exists (
    select 1 from public.email_outbox o
     where (o.status = 'pendente' and o.proxima_tentativa <= now())
        or (o.status = 'enviando' and o.reservado_em < now() - interval '10 minutes')
  ) then
    return null;
  end if;
  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'send_emails_url';
  select s.decrypted_secret into v_segredo from vault.decrypted_secrets s where s.name = 'send_emails_secret';
  if v_url is null or v_segredo is null then
    return null;
  end if;
  return net.http_post(
    url := v_url,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', v_segredo),
    timeout_milliseconds := 60000
  );
end $$;

revoke all on function public.erro_sem_dados_pessoais(text) from public, anon, authenticated;
revoke all on function public.reservar_emails(integer) from public, anon, authenticated;
revoke all on function public.concluir_email(bigint, boolean, text, text) from public, anon, authenticated;
revoke all on function public.disparar_envio_emails() from public, anon, authenticated;
grant execute on function public.reservar_emails(integer) to service_role;
grant execute on function public.concluir_email(bigint, boolean, text, text) to service_role;

select cron.schedule('enviar-emails', '* * * * *', $$select public.disparar_envio_emails()$$);
