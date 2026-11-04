-- Organização edita, inclui ou retira o trabalho de quem apresenta (WML-79).
-- Casos: digitou errado (corrige título, autores e resumo); decidiu apresentar de última hora
-- (inclui trabalho numa inscrição que era só para assistir); desistiu de apresentar (retira só o
-- trabalho: a inscrição, e o minicurso se houver, continuam — cancelar tudo segue em
-- admin_cancelar_inscricao).
--
-- Decisões (manual da organização §4.6):
-- - Mesmas regras de texto da inscrição: título 3–250, autores 3–600, resumo 10–1500 caracteres;
--   título e autores com espaços normalizados (uma linha), resumo aparado nas pontas.
-- - A organização pode incluir fora da janela de submissão (é ela quem define a janela).
-- - Trabalho incluído entra como 'pendente', sem premiação e SEM autorização do acervo (o opt-in é
--   do autor — ADR-007; se ele autorizar por e-mail, use "Registrar autorização do acervo").
-- - Corrigir mantém status e autorização do acervo. Se o trabalho já foi para o acervo (depois de
--   31/01/2027), a cópia do acervo recebe a mesma correção.
-- - Retirar apaga o trabalho; se já estiver no acervo, sai dele (retirar_do_acervo); PDF enviado
--   até 03/11/2026 vai para a fila do expurgo (pdfs_a_apagar), que apaga o arquivo do Storage.
-- - Nenhum e-mail automático: o painel já tem "Reenviar" (o comprovante é montado na hora do envio).
-- - Inscrição cancelada é recusada (INSCRICAO_CANCELADA).
-- Não redefine register_participant nem admin_corrigir_inscricao.

create function public.admin_salvar_trabalho(
  p_numero text,
  p_titulo text,
  p_autores text,
  p_resumo text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_titulo text := regexp_replace(btrim(coalesce(p_titulo, '')), '\s+', ' ', 'g');
  v_autores text := regexp_replace(btrim(coalesce(p_autores, '')), '\s+', ' ', 'g');
  -- Resumo mantém as quebras de linha; só perde espaços e quebras das pontas.
  v_resumo text := btrim(coalesce(p_resumo, ''), E' \t\r\n');
  v_acervo uuid;
begin
  if not public.pode_administrar() then
    raise exception 'NAO_AUTORIZADO';
  end if;
  v_id := public.participante_por_numero(p_numero);
  -- Trava a inscrição: mudanças simultâneas na mesma pessoa rodam uma depois da outra.
  perform 1 from public.participantes p where p.id = v_id and p.cancelada_em is null for update;
  if not found then
    raise exception 'INSCRICAO_CANCELADA';
  end if;
  if char_length(v_titulo) not between 3 and 250 then
    raise exception 'TITULO_INVALIDO';
  end if;
  if char_length(v_autores) not between 3 and 600 then
    raise exception 'AUTORES_INVALIDOS';
  end if;
  if char_length(v_resumo) not between 10 and 1500 then
    raise exception 'RESUMO_INVALIDO';
  end if;

  update public.trabalhos t
     set titulo = v_titulo, autores = v_autores, resumo = v_resumo
   where t.participante_id = v_id
  returning t.acervo_id into v_acervo;
  if found then
    if v_acervo is not null then
      update public.acervo_trabalhos a
         set titulo = v_titulo, autores = v_autores, resumo = v_resumo
       where a.id = v_acervo;
    end if;
  else
    insert into public.trabalhos (participante_id, titulo, autores, resumo)
    values (v_id, v_titulo, v_autores, v_resumo); -- status 'pendente', acervo = false (padrões)
  end if;
end $$;

create function public.admin_retirar_trabalho(p_numero text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_t public.trabalhos;
begin
  if not public.pode_administrar() then
    raise exception 'NAO_AUTORIZADO';
  end if;
  v_id := public.participante_por_numero(p_numero);
  perform 1 from public.participantes p where p.id = v_id and p.cancelada_em is null for update;
  if not found then
    raise exception 'INSCRICAO_CANCELADA';
  end if;

  delete from public.trabalhos t where t.participante_id = v_id returning * into v_t;
  if not found then
    return; -- já estava sem trabalho: nada muda
  end if;
  if v_t.acervo_id is not null then
    perform public.retirar_do_acervo(v_t.acervo_id); -- título/autores/resumo saem; PDF vai para a fila
  end if;
  if v_t.pdf_path is not null then
    insert into public.pdfs_a_apagar (caminho) values (v_t.pdf_path) on conflict do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Painel: listagem com autores e resumo, para o diálogo de correção (CPF continua mascarado)
-- ---------------------------------------------------------------------------

drop function public.admin_listar_inscricoes();

create function public.admin_listar_inscricoes()
returns table (
  numero text, nome text, email text, cpf_mascarado text, instituicao text,
  minicurso boolean, apresenta_trabalho boolean, titulo_trabalho text, status_trabalho text,
  concorre_premio boolean, nivel text, criada_em timestamptz, cancelada boolean,
  pdf_path text, email_status text, dias_presente date[], dias_minicurso date[],
  vinculo text, curso text, perfil_url text, vinculo_outro text, acervo boolean,
  autores_trabalho text, resumo_trabalho text
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.pode_administrar() then
    raise exception 'NAO_AUTORIZADO';
  end if;
  return query
  select p.numero, p.nome, p.email, public.mascarar_cpf(p.cpf), p.instituicao,
         exists (select 1 from public.inscricoes_minicurso i where i.participante_id = p.id),
         t.id is not null, t.titulo, t.status::text, coalesce(t.premio, false), t.nivel::text,
         p.criada_em, p.cancelada_em is not null, t.pdf_path,
         (select o.status from public.email_outbox o
           where o.participante_id = p.id and o.tipo = 'confirmacao'
           order by o.id desc limit 1),
         coalesce((select array_agg(pr.dia order by pr.dia) from public.presencas pr
                    where pr.participante_id = p.id and pr.minicurso_id is null), '{}'),
         coalesce((select array_agg(pr.dia order by pr.dia) from public.presencas pr
                    where pr.participante_id = p.id and pr.minicurso_id is not null), '{}'),
         p.vinculo::text, p.curso, p.perfil_url, p.vinculo_outro, coalesce(t.acervo, false),
         t.autores, t.resumo
    from public.participantes p
    left join public.trabalhos t on t.participante_id = p.id
   order by p.criada_em;
end $$;

-- ---------------------------------------------------------------------------
-- Privilégios (explícitos, além dos default privileges)
-- ---------------------------------------------------------------------------

revoke all on function public.admin_salvar_trabalho(text, text, text, text) from public, anon;
revoke all on function public.admin_retirar_trabalho(text) from public, anon;
revoke all on function public.admin_listar_inscricoes() from public, anon;

grant execute on function public.admin_salvar_trabalho(text, text, text, text) to authenticated, service_role;
grant execute on function public.admin_retirar_trabalho(text) to authenticated, service_role;
grant execute on function public.admin_listar_inscricoes() to authenticated, service_role;
