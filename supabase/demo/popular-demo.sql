-- Dados de DEMONSTRAÇÃO para a apresentação aos stakeholders (WML-40). SOMENTE staging ou local.
--
-- Como usar: cole tudo no SQL Editor do STAGING e rode. Desfazer: limpar-demo.sql (mesma pasta).
--
-- Tudo é sintético: nomes fictícios, e-mails demo-NN@exemplo.com e CPFs gerados na hora.
-- Usa as funções do próprio sistema (register_participant, cancel_registration, check_in,
-- admin_definir_status_trabalho): as vagas do minicurso contam certo e nada passa por fora
-- das regras. Os e-mails de confirmação das inscrições fictícias saem da fila na mesma transação
-- (exemplo.com não recebe e-mail), então o Gmail não tenta enviá-los.
--
-- Antes de rodar, no painel do staging: inscrições e submissões abertas (Configuração) e
-- pelo menos 6 vagas livres no minicurso.

do $$
declare
  v_url text;
  v_cfg public.config_evento;
  v_livres integer;
  v_operador text;
  v_pessoa record;
  v_base text;
  v_soma integer;
  v_d1 integer;
  v_d2 integer;
  v_cpf text;
  v_id uuid;
  v_numero text;
  v_i integer;
begin
  -- Trava: o cron de e-mail de cada ambiente aponta para a própria URL. Só staging ou local.
  select s.decrypted_secret into v_url from vault.decrypted_secrets s where s.name = 'send_emails_url';
  if v_url is null or v_url like '%sjzyipebykiaiasdafai%'
     or not (v_url like 'https://aiyzqeckoyalrhlvhmmf.supabase.co/%' or v_url like 'http://kong:8000/%') then
    raise exception 'Recusado: os dados de demonstração só entram no staging ou no banco local.';
  end if;

  if exists (select 1 from public.participantes p where p.email like 'demo-%@exemplo.com') then
    raise exception 'Já existem dados de demonstração. Rode limpar-demo.sql antes de repetir.';
  end if;

  select * into v_cfg from public.config_evento c where c.id;
  if now() not between v_cfg.inscricoes_inicio and v_cfg.inscricoes_fim
     or now() not between v_cfg.submissoes_inicio and v_cfg.submissoes_fim then
    raise exception 'Abra as inscrições e as submissões no painel (/admin → Configuração) antes.';
  end if;

  select m.vagas - m.ocupadas into v_livres from public.minicursos m where m.slug = 'ml-na-pratica';
  if v_livres is null or v_livres < 6 then
    raise exception 'Defina as vagas do minicurso no painel: são precisas pelo menos 6 livres.';
  end if;

  select o.email into v_operador from public.organizadores o order by o.criado_em limit 1;
  if v_operador is null then
    raise exception 'Cadastre um organizador antes (tabela organizadores).';
  end if;

  -- Mesmo papel que a Edge Function usa; vale só dentro desta transação.
  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

  for v_pessoa in
    select * from (values
      -- n, nome, instituição, minicurso, trabalho, status do trabalho, dias (1-3), tardes (1-3), cancelar
      (1, 'Alice Fictícia Souza', 'UFAL', true,
       '{"titulo":"Redes neurais para previsão de chuva em Maceió","autores":"Alice Fictícia Souza; Bruno Exemplo Lima","resumo":"Estudo sintético usado só na demonstração do sistema de inscrição.","premio":true,"nivel":"graduacao"}'::jsonb,
       'aprovado_oral'::public.status_trabalho, '{1,2,3}'::int[], '{1,2,3}'::int[], false),
      (2, 'Bruno Exemplo Lima', 'UFAL', true, null, null, '{1,2,3}', '{1,2}', false),
      (3, 'Carla Teste Ramos', 'IFAL', true,
       '{"titulo":"Classificação de imagens de satélite com poucos dados","autores":"Carla Teste Ramos","resumo":"Trabalho fictício para mostrar a lista de trabalhos no painel.","premio":false}'::jsonb,
       'aprovado_poster', '{1,2}', '{1,2,3}', false),
      (4, 'Davi Modelo Araújo', 'UNCISAL', false, null, null, '{1}', '{}', false),
      (5, 'Elisa Amostra Costa', 'UFAL', true, null, null, '{}', '{}', false),
      (6, 'Felipe Ensaio Rocha', 'UFAL', false,
       '{"titulo":"Detecção de fraudes com aprendizado semissupervisionado","autores":"Felipe Ensaio Rocha; Gabriela Protótipo Melo","resumo":"Resumo fictício de um trabalho de mestrado concorrendo ao prêmio.","premio":true,"nivel":"mestrado"}'::jsonb,
       'pendente', '{2,3}', '{}', false),
      (7, 'Gabriela Protótipo Melo', null, false, null, null, '{1,2,3}', '{}', false),
      (8, 'Heitor Simulado Nunes', 'UFAL', true, null, null, '{3}', '{3}', false),
      (9, 'Isadora Hipótese Dias', 'UFRPE', false, null, null, '{}', '{}', false),
      (10, 'João Fictício Barros', 'UFAL', true, null, null, '{}', '{}', true),
      (11, 'Karen Demonstração Alves', 'IFAL', false, null, null, '{1,2}', '{}', false),
      (12, 'Lucas Rascunho Freitas', 'UFAL', false, null, null, '{}', '{}', false)
    ) as t (n, nome, instituicao, minicurso, trabalho, status, dias, tardes, cancelar)
  loop
    -- CPF sintético válido (dígitos verificadores calculados; cpf_valido recusa repetidos).
    loop
      v_base := lpad(floor(random() * 1000000000)::bigint::text, 9, '0');
      v_soma := 0;
      for v_i in 1..9 loop
        v_soma := v_soma + substr(v_base, v_i, 1)::int * (11 - v_i);
      end loop;
      v_d1 := case when v_soma % 11 < 2 then 0 else 11 - v_soma % 11 end;
      v_soma := v_d1 * 2;
      for v_i in 1..9 loop
        v_soma := v_soma + substr(v_base, v_i, 1)::int * (12 - v_i);
      end loop;
      v_d2 := case when v_soma % 11 < 2 then 0 else 11 - v_soma % 11 end;
      v_cpf := v_base || v_d1 || v_d2;
      exit when public.cpf_valido(v_cpf);
    end loop;

    select r.id_inscricao, r.numero_inscricao into v_id, v_numero
      from public.register_participant(
        v_pessoa.nome, v_cpf, format('demo-%s@exemplo.com', lpad(v_pessoa.n::text, 2, '0')),
        v_pessoa.instituicao,
        case when v_pessoa.minicurso
             then array[(select m.id from public.minicursos m where m.slug = 'ml-na-pratica')]
             else '{}'::smallint[] end,
        v_pessoa.trabalho
      ) r;

    if v_pessoa.status is not null and v_pessoa.status <> 'pendente' then
      perform public.admin_definir_status_trabalho(v_numero, v_pessoa.status);
    end if;

    foreach v_i in array v_pessoa.dias loop
      perform public.check_in(v_numero, v_cfg.dias_evento[v_i], null, 'manual', v_operador);
    end loop;
    foreach v_i in array v_pessoa.tardes loop
      perform public.check_in(v_numero, v_cfg.dias_evento[v_i], 'ml-na-pratica', 'manual', v_operador);
    end loop;

    if v_pessoa.cancelar then
      perform public.cancel_registration(v_id);
    end if;
  end loop;

  -- Ninguém em exemplo.com recebe e-mail: tira da fila antes de o cron enxergar (mesma transação).
  delete from public.email_outbox o
   using public.participantes p
   where o.participante_id = p.id and p.email like 'demo-%@exemplo.com' and o.status = 'pendente';
end $$;

-- Cola para a apresentação: números e e-mails fictícios (CPF só mascarado).
select p.numero,
       p.nome,
       p.email,
       public.mascarar_cpf(p.cpf) as cpf,
       exists (select 1 from public.inscricoes_minicurso i where i.participante_id = p.id) as minicurso,
       t.status as trabalho,
       (select count(*) from public.presencas pr where pr.participante_id = p.id) as presencas,
       round(public.horas_participante(p.id) / 60.0, 1) as horas,
       p.cancelada_em is not null as cancelada
  from public.participantes p
  left join public.trabalhos t on t.participante_id = p.id
 where p.email like 'demo-%@exemplo.com'
 order by p.email;
