-- Expurgo LGPD pós-evento (WML-52 · S6): datas da política de privacidade (src/data/evento.ts).
-- PDFs até 31/01/2027 · CPF, e-mail e instituição até 31/03/2027 · o resto até 31/12/2031.
-- CPFs e e-mails sintéticos — nunca use dados reais.
begin;
select plan(24);

-- O expurgo age sobre TODAS as inscrições: começa do zero (o rollback do fim desfaz).
delete from public.participantes;

update public.config_evento
   set inscricoes_inicio = now() - interval '1 day', inscricoes_fim = now() + interval '1 day',
       submissoes_inicio = now() - interval '1 day', submissoes_fim = now() + interval '1 day';
update public.minicursos set vagas = 10 where slug = 'ml-na-pratica';
insert into public.organizadores (email) values ('org@exemplo.com');

create temp table insc as
  select 'ana' as quem, * from public.register_participant('Ana Expurgo', '529.982.247-25', 'ana.expurgo@exemplo.com',
    'UFAL', array[(select id from public.minicursos where slug = 'ml-na-pratica')],
    '{"titulo": "Trabalho da Ana", "autores": "Ana", "resumo": "Resumo sintético do trabalho.", "premio": false}')
  union all
  select 'bia', * from public.register_participant('Bia Expurgo', '111.444.777-35', 'bia.expurgo@exemplo.com', null, '{}', null);
create function pg_temp.pid(p_quem text) returns uuid language sql as $$
  select id_inscricao from insc where quem = p_quem $$;

update public.trabalhos set pdf_path = 'expurgo-teste.pdf' where participante_id = pg_temp.pid('ana');
do $$ begin
  perform public.check_in((select numero_inscricao from insc where quem = 'ana'), '2026-12-02', null, 'manual', 'org@exemplo.com');
end $$;
insert into public.certificados (participante_id, codigo, minutos)
values (pg_temp.pid('ana'), 'AAAAA-BBBBB-CCCCC-DDDDD', 180);

-- datas e privilégios ------------------------------------------------------------------
select is((select expurgo_pdfs from public.config_evento), '2027-01-31'::date, 'PDFs: 31/01/2027');
select is((select expurgo_pessoais from public.config_evento), '2027-03-31'::date, 'CPF, e-mail, instituição: 31/03/2027');
select is((select expurgo_final from public.config_evento), '2031-12-31'::date, 'certificado: 31/12/2031');
select ok(not has_function_privilege('anon', 'public.expurgar_dados(date)', 'execute'), 'anon NÃO expurga');
select ok(not has_function_privilege('authenticated', 'public.expurgar_dados(date)', 'execute'),
  'nem organizador expurga pelo navegador');
select ok(not has_function_privilege('authenticated', 'public.expurgo_pdfs_pendentes(date)', 'execute'),
  'lista de PDFs a apagar só para o servidor');
select ok(not has_function_privilege('authenticated', 'public.concluir_expurgo_pdfs(text[])', 'execute'),
  'conclusão do expurgo de PDFs só para o servidor');

-- antes dos prazos nada muda -------------------------------------------------------------
select is((public.expurgar_dados('2026-12-10') ->> 'dados_pessoais')::int, 0, 'antes do prazo: nada apagado');
select is((select cpf from public.participantes where id = pg_temp.pid('ana')), '52998224725', 'CPF intacto antes do prazo');
select is(public.expurgo_pdfs_pendentes('2027-01-31'), '{}'::text[], 'no último dia do prazo, nenhum PDF a apagar');

-- PDFs (01/02/2027) ------------------------------------------------------------------------
select is(public.expurgo_pdfs_pendentes('2027-02-01'), array['expurgo-teste.pdf'], 'depois do prazo: lista os PDFs');
select lives_ok($$ select public.concluir_expurgo_pdfs(array['expurgo-teste.pdf']) $$, 'marca os PDFs como apagados');
select is((select pdf_path from public.trabalhos where participante_id = pg_temp.pid('ana')), null,
  'caminho do PDF limpo depois de apagar o arquivo');

-- dados pessoais (01/04/2027) ------------------------------------------------------------------
select is((public.expurgar_dados('2027-04-01') ->> 'dados_pessoais')::int, 2, 'apaga CPF, e-mail e instituição dos 2');
select is((select count(*)::int from public.participantes where cpf is not null or email is not null or instituicao is not null),
  0, 'nenhum CPF, e-mail ou instituição sobra');
select is((select count(*)::int from public.inscricoes_minicurso where cpf is not null), 0, 'CPF sai também do minicurso');
select is((select count(*)::int from public.email_outbox), 0, 'fila de e-mail apagada');
select is((select count(*)::int from public.presencas where operador <> 'expurgado'), 0, 'e-mail do operador apagado das presenças');
select is((select nome || '|' || cpf_mascarado || '|' || minutos from public.validar_certificado('AAAAA-BBBBB-CCCCC-DDDDD')),
  'Ana Expurgo|***.***.***-**|180', 'validação pública continua (nome e horas), sem CPF');
select is((select count(*)::int from public.certificado_para_download('ana.expurgo@exemplo.com',
            (select numero_inscricao from insc where quem = 'ana'))), 0, 'download deixa de existir sem e-mail');
select is((public.expurgar_dados('2027-04-02') ->> 'dados_pessoais')::int, 0, 'rodar de novo não faz nada');

-- final (01/01/2032) ----------------------------------------------------------------------------
select is((public.expurgar_dados('2032-01-01') ->> 'participantes')::int, 2, 'apaga as inscrições restantes');
select is((select count(*)::int from public.participantes where id in (pg_temp.pid('ana'), pg_temp.pid('bia'))), 0,
  'nenhuma inscrição sobra');
select is((select count(*)::int from public.certificados), 0, 'emissões apagadas junto (validação encerrada)');

select * from finish();
rollback;
