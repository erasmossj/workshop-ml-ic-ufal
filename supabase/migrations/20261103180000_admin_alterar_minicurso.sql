-- Organização inclui ou tira alguém do minicurso depois da inscrição (ADR-003, atualizado em
-- 03/11/2026). Ex.: inscreveu-se só nas palestras e depois pediu vaga no minicurso.
-- Mesmas regras da inscrição: vaga ocupada com UPDATE condicional (sem overbooking), minicurso sem
-- vagas definidas = fechado, CPF único por minicurso. Quem já tem presença no minicurso não sai
-- (a presença alimenta o certificado). Toda mudança põe o e-mail de confirmação na fila: o
-- comprovante é montado na hora do envio, já com o minicurso atualizado.

create function public.admin_alterar_minicurso(
  p_numero text,
  p_minicurso smallint,
  p_inscrever boolean
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_cpf text;
  v_vagas integer;
begin
  if not public.pode_administrar() then
    raise exception 'NAO_AUTORIZADO';
  end if;
  v_id := public.participante_por_numero(p_numero);
  -- Trava a inscrição: duas mudanças simultâneas na mesma pessoa rodam uma depois da outra.
  select p.cpf into v_cpf from public.participantes p
   where p.id = v_id and p.cancelada_em is null
     for update;
  if not found then
    raise exception 'INSCRICAO_CANCELADA';
  end if;
  select m.vagas into v_vagas from public.minicursos m where m.id = p_minicurso;
  if not found then
    raise exception 'MINICURSO_INEXISTENTE';
  end if;

  if p_inscrever then
    if exists (
      select 1 from public.inscricoes_minicurso i
       where i.participante_id = v_id and i.minicurso_id = p_minicurso
    ) then
      return; -- já está no minicurso: nada muda, nenhum e-mail
    end if;
    if v_vagas is null then
      raise exception 'MINICURSO_FECHADO';
    end if;
    -- Atômico (ADR-003): em concorrência, o segundo UPDATE reavalia a condição após o commit do primeiro.
    update public.minicursos m set ocupadas = m.ocupadas + 1
     where m.id = p_minicurso and m.ocupadas < m.vagas;
    if not found then
      raise exception 'MINICURSO_ESGOTADO';
    end if;
    begin
      insert into public.inscricoes_minicurso (participante_id, minicurso_id, cpf)
      values (v_id, p_minicurso, v_cpf);
    exception when unique_violation then
      raise exception 'CPF_JA_NO_MINICURSO'; -- a exceção desfaz também o UPDATE da vaga
    end;
  else
    if exists (
      select 1 from public.presencas pr
       where pr.participante_id = v_id and pr.minicurso_id = p_minicurso
    ) then
      raise exception 'MINICURSO_COM_PRESENCA';
    end if;
    delete from public.inscricoes_minicurso i
     where i.participante_id = v_id and i.minicurso_id = p_minicurso;
    if not found then
      return; -- já estava fora: nada muda, nenhum e-mail
    end if;
    update public.minicursos m set ocupadas = m.ocupadas - 1 where m.id = p_minicurso;
  end if;

  if not exists (
    select 1 from public.email_outbox o
     where o.participante_id = v_id and o.tipo = 'confirmacao' and o.status in ('pendente', 'enviando')
  ) then
    insert into public.email_outbox (participante_id, tipo) values (v_id, 'confirmacao');
  end if;
end $$;

revoke all on function public.admin_alterar_minicurso(text, smallint, boolean) from public, anon;
grant execute on function public.admin_alterar_minicurso(text, smallint, boolean) to authenticated, service_role;
