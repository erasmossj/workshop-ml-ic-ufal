-- Certificados (WML-57..60 · ADR-002/005): carga horária, horas, modelo, liberação, validação.
-- CPFs e e-mails sintéticos — nunca use dados reais.
begin;
select plan(52);

update public.config_evento
   set inscricoes_inicio = now() - interval '1 day', inscricoes_fim = now() + interval '1 day';
update public.minicursos set vagas = 10 where slug = 'ml-na-pratica';
insert into public.organizadores (email) values ('org@exemplo.com');

create temp table insc as
  select 'ana' as quem, * from public.register_participant('Ana Certificado', '529.982.247-25', 'ana.cert@exemplo.com', null,
    array[(select id from public.minicursos where slug = 'ml-na-pratica')], null)
  union all
  select 'bia', * from public.register_participant('Bia Certificado', '111.444.777-35', 'bia.cert@exemplo.com', null, '{}', null)
  union all
  select 'caio', * from public.register_participant('Caio Certificado', '123.456.789-09', 'caio.cert@exemplo.com', null, '{}', null)
  union all
  select 'davi', * from public.register_participant('Davi Certificado', '935.411.347-80', 'davi.cert@exemplo.com', null, '{}', null);

create function pg_temp.num(p_quem text) returns text language sql as $$
  select numero_inscricao from insc where quem = p_quem $$;
create function pg_temp.pid(p_quem text) returns uuid language sql as $$
  select id_inscricao from insc where quem = p_quem $$;

-- Presenças: Ana 02 e 03 (palestras) + tardes 02 e 03; Bia 04; Caio 02 e depois cancela; Davi nada.
-- (dentro de um bloco: o resultado "ok|..." confundiria o leitor de TAP)
do $$
declare
  v record;
begin
  for v in select * from (values
      ('ana', '2026-12-02'::date, null::text), ('ana', '2026-12-03', null), ('ana', '2026-12-02', 'ml-na-pratica'),
      ('ana', '2026-12-03', 'ml-na-pratica'), ('bia', '2026-12-04', null), ('caio', '2026-12-02', null))
      as t (quem, dia, mc)
  loop
    perform public.check_in(pg_temp.num(v.quem), v.dia, v.mc, 'manual', 'org@exemplo.com');
  end loop;
end $$;
set local request.jwt.claims = '{"role":"service_role"}';
select public.cancel_registration(pg_temp.pid('caio'));
reset request.jwt.claims;

-- estrutura ---------------------------------------------------------------------------
select has_table('public', 'atividades_certificado', 'tabela de carga horária existe');
select has_table('public', 'certificados', 'tabela de certificados emitidos existe');
select has_table('public', 'config_certificado', 'tabela do modelo existe');
select is((select count(*)::int from pg_tables where schemaname = 'public'
            and tablename in ('atividades_certificado', 'certificados', 'config_certificado') and rowsecurity), 3,
  'as três tabelas nascem com RLS');
select is((select public from storage.buckets where id = 'certificados'), false, 'bucket do modelo é privado');

-- carga horária inicial (programação de src/data/evento.ts, sem pausas) ----------------
select is((select count(*)::int from public.atividades_certificado), 6, '3 manhãs + 3 tardes de minicurso');
select is((select sum(minutos)::int from public.atividades_certificado), 1320, 'total do evento: 22 horas');

-- horas do participante ---------------------------------------------------------------
select is(public.horas_participante(pg_temp.pid('ana')), 860, 'Ana: 180 + 240 (manhãs) + 220 + 220 (tardes)');
select is(public.horas_participante(pg_temp.pid('bia')), 240, 'Bia: manhã de 04/12');
select is(public.horas_participante(pg_temp.pid('caio')), 0, 'inscrição cancelada não soma horas');
select is(public.horas_participante(pg_temp.pid('davi')), 0, 'sem presença, zero horas');

-- privilégios -------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.horas_participante(uuid)', 'execute'), 'anon NÃO calcula horas');
select ok(not has_function_privilege('authenticated', 'public.horas_participante(uuid)', 'execute'),
  'authenticated NÃO calcula horas direto');
select ok(not has_function_privilege('anon', 'public.certificado_por_numero(text)', 'execute'),
  'anon NÃO lê dados do certificado (CPF completo)');
select ok(not has_function_privilege('authenticated', 'public.certificado_por_numero(text)', 'execute'),
  'authenticated NÃO lê CPF completo');
select ok(not has_function_privilege('anon', 'public.certificado_para_download(text,text)', 'execute'),
  'anon NÃO chama o download direto (só pela Edge Function com Turnstile)');
select ok(has_function_privilege('anon', 'public.validar_certificado(text)', 'execute'),
  'anon valida certificado por código');
select ok(not has_function_privilege('anon', 'public.admin_liberar_certificados()', 'execute'), 'anon NÃO libera');

-- intruso -----------------------------------------------------------------------------
set local request.jwt.claims = '{"role":"authenticated","email":"intruso@exemplo.com"}';
select throws_ok('select public.admin_listar_atividades()', 'P0001', 'NAO_AUTORIZADO', 'intruso não lista atividades');
select throws_ok($$ select public.admin_definir_carga(1::smallint, 'X', 999) $$, 'P0001', 'NAO_AUTORIZADO',
  'intruso não muda carga horária');
select throws_ok('select public.admin_obter_modelo_certificado()', 'P0001', 'NAO_AUTORIZADO', 'intruso não lê o modelo');
select throws_ok($$ select public.admin_salvar_modelo_certificado('x.pdf', '{}') $$, 'P0001', 'NAO_AUTORIZADO',
  'intruso não salva modelo');
select throws_ok('select public.admin_liberar_certificados()', 'P0001', 'NAO_AUTORIZADO', 'intruso não libera');
select throws_ok('select public.admin_resumo_certificados()', 'P0001', 'NAO_AUTORIZADO', 'intruso não vê resumo');
set local role authenticated;
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('certificados', 'intruso.pdf') $$, '42501', null,
  'intruso não grava no bucket do modelo');
reset role;

-- organizador: carga horária ------------------------------------------------------------
set local request.jwt.claims = '{"role":"authenticated","email":"org@exemplo.com"}';
select is(jsonb_array_length(public.admin_listar_atividades()), 6, 'organizador lista as 6 atividades');
select lives_ok($$ select public.admin_definir_carga(
  (select id from public.atividades_certificado where dia = '2026-12-03' and minicurso_id is null),
  'Apresentações de trabalhos', 210) $$, 'organizador ajusta a carga de 03/12');
select is(public.horas_participante(pg_temp.pid('ana')), 830, 'horas recalculadas com a nova carga');
select throws_ok($$ select public.admin_definir_carga(1::smallint, 'X', -5) $$, 'P0001', 'CARGA_INVALIDA',
  'carga negativa é recusada');
select throws_ok($$ select public.admin_definir_carga(1::smallint, '', 60) $$, 'P0001', 'CARGA_INVALIDA',
  'título vazio é recusado');

-- organizador: modelo ------------------------------------------------------------------
select throws_ok('select public.admin_liberar_certificados()', 'P0001', 'MODELO_INCOMPLETO',
  'não libera sem modelo configurado');
set local role authenticated;
insert into storage.objects (bucket_id, name) values ('certificados', '00000000-0000-4000-8000-000000000001.pdf');
reset role;
select throws_ok($$ select public.admin_salvar_modelo_certificado('../trabalhos/x.pdf', '{}') $$, 'P0001',
  'MODELO_INVALIDO', 'caminho fora do padrão é recusado');
select throws_ok($$ select public.admin_salvar_modelo_certificado('00000000-0000-4000-8000-000000000099.pdf', '{}') $$,
  'P0001', 'MODELO_INVALIDO', 'arquivo que não existe no bucket é recusado');

create temp table campo as select
  '{"pagina":0,"x":100,"y":200,"largura":400,"tamanho":24,"alinhamento":"centro","fonte":"helvetica-negrito"}'::jsonb as c;
select throws_ok($$ select public.admin_salvar_modelo_certificado('00000000-0000-4000-8000-000000000001.pdf',
  jsonb_build_object('nome', (select c from campo), 'cpf', (select c from campo))) $$,
  'P0001', 'CAMPOS_INVALIDOS', 'falta a posição das horas');
select throws_ok($$ select public.admin_salvar_modelo_certificado('00000000-0000-4000-8000-000000000001.pdf',
  jsonb_build_object('nome', (select c from campo) || '{"tamanho": 500}', 'cpf', (select c from campo),
                     'horas', (select c from campo))) $$,
  'P0001', 'CAMPOS_INVALIDOS', 'tamanho de fonte absurdo é recusado');
select throws_ok($$ select public.admin_salvar_modelo_certificado('00000000-0000-4000-8000-000000000001.pdf',
  jsonb_build_object('nome', (select c from campo) || '{"fonte": "comic-sans"}', 'cpf', (select c from campo),
                     'horas', (select c from campo))) $$,
  'P0001', 'CAMPOS_INVALIDOS', 'fonte fora da lista é recusada');
select lives_ok($$ select public.admin_salvar_modelo_certificado('00000000-0000-4000-8000-000000000001.pdf',
  jsonb_build_object('nome', (select c from campo), 'cpf', (select c from campo) || '{"y": 260, "tamanho": 14}',
                     'horas', (select c from campo) || '{"y": 300, "tamanho": 14}')) $$, 'modelo válido é salvo');
select is(public.admin_obter_modelo_certificado() ->> 'template_path', '00000000-0000-4000-8000-000000000001.pdf',
  'modelo salvo é lido de volta');

-- liberação ----------------------------------------------------------------------------
select is((public.admin_liberar_certificados() ->> 'emitidos')::int, 2, 'libera para quem tem horas (Ana e Bia)');
select is((select minutos from public.certificados where participante_id = pg_temp.pid('ana')), 830,
  'horas congeladas na emissão');
select is((select count(*)::int from public.email_outbox where tipo = 'certificado'), 2,
  'um e-mail de certificado por emitido, na fila');
select is((public.admin_liberar_certificados() ->> 'emitidos')::int, 0, 'liberar de novo não duplica');
select is((select count(*)::int from public.email_outbox where tipo = 'certificado'), 2, 'nem os e-mails');
select ok((select bool_and(codigo ~ '^[0-9A-HJKMNP-TV-Z]{5}(-[0-9A-HJKMNP-TV-Z]{5}){3}$') from public.certificados),
  'código no formato XXXXX-XXXXX-XXXXX-XXXXX (base32 sem letras ambíguas)');
select is((select count(distinct codigo)::int from public.certificados), 2, 'códigos diferentes');
select is((public.admin_resumo_certificados() ->> 'emitidos')::int, 2, 'resumo conta os emitidos');

-- validação pública (anon) -----------------------------------------------------------------
select set_config('teste.codigo',
  (select codigo from public.certificados where participante_id = pg_temp.pid('ana')), true);
reset request.jwt.claims;
set local role anon;
select is((select nome || '|' || cpf_mascarado || '|' || minutos
             from public.validar_certificado(lower(replace(current_setting('teste.codigo'), '-', ' ')))),
  'Ana Certificado|***.982.247-**|830', 'anon valida com código em minúsculas e sem hífens; CPF mascarado');
select is((select count(*)::int from public.validar_certificado('ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ')), 0,
  'código inexistente não retorna nada');
select is((select count(*)::int from public.validar_certificado('')), 0, 'código vazio não retorna nada');
reset role;

-- dados para o PDF (só servidor) ---------------------------------------------------------
select is((select cpf from public.certificado_por_numero(pg_temp.num('ana'))), '52998224725',
  'servidor recebe o CPF completo para o PDF');
select is((select count(*)::int from public.certificado_para_download(' ANA.CERT@Exemplo.com ', lower(pg_temp.num('ana')))), 1,
  'download por e-mail + número (normalizados)');
select is((select count(*)::int from public.certificado_para_download('ana.cert@exemplo.com', pg_temp.num('bia'))), 0,
  'e-mail de uma pessoa com número de outra não baixa nada');

select * from finish();
rollback;
