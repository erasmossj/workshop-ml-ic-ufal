-- Limite de requisições por origem (WML-26 · threat model: robôs e flood).
-- A chave é um hash SHA-256 do IP com sal, calculado na Edge Function: o IP nunca é guardado (LGPD).

create table public.limite_requisicoes (
  chave text not null,
  janela_inicio timestamptz not null,
  contagem integer not null default 0,
  primary key (chave, janela_inicio)
);
create index limite_requisicoes_janela_idx on public.limite_requisicoes (janela_inicio);

alter table public.limite_requisicoes enable row level security;
revoke all on public.limite_requisicoes from anon, authenticated;

-- Conta a requisição na janela fixa atual e diz se ainda está dentro do limite.
create function public.consumir_limite(p_chave text, p_max integer, p_janela_segundos integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_inicio timestamptz :=
    to_timestamp(floor(extract(epoch from now()) / p_janela_segundos) * p_janela_segundos);
  v_contagem integer;
begin
  insert into public.limite_requisicoes as l (chave, janela_inicio, contagem)
  values (p_chave, v_inicio, 1)
  on conflict (chave, janela_inicio) do update set contagem = l.contagem + 1
  returning l.contagem into v_contagem;

  -- Limpeza ocasional das janelas antigas (barata e sem job extra).
  if random() < 0.02 then
    delete from public.limite_requisicoes where janela_inicio < now() - interval '1 day';
  end if;

  return v_contagem <= p_max;
end $$;

revoke all on function public.consumir_limite(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consumir_limite(text, integer, integer) to service_role;
