// Integração da Edge Function `check-in` (WML-54/55 · S4) contra o Supabase LOCAL, com login real
// (magic link) e QR assinado com o segredo local. Pré-requisito: `npm run db:start` e
// `npm run functions:serve`. Usuários e inscrições sintéticos, criados e apagados aqui.
// CORS não é testado aqui: o Kong local responde com `*`. Coberto por origens.test.ts e pelo
// pentest no staging (scripts/pentest-staging.mjs).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assinarInscricao } from '../../supabase/functions/_shared/qr';

const env = Object.fromEntries(
  execSync('npx supabase status -o env', { encoding: 'utf8' })
    .split(/\r?\n/)
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')];
    }),
);
const API = env.API_URL;
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(API ?? '')) {
  throw new Error('Os testes de integração só rodam contra o Supabase local.');
}
const SEGREDO_QR =
  readFileSync('supabase/functions/.env', 'utf8')
    .match(/^QR_HMAC_SECRET=(.+)$/m)?.[1]
    ?.trim() ?? '';
const FUNCAO = `${API}/functions/v1/check-in`;
const ORIGEM = 'http://localhost:4321';
const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
const servico = createClient(API, env.SERVICE_ROLE_KEY, opcoes);

const sufixo = Date.now();
const ORG = `org-cred-${sufixo}@exemplo.com`;
const INTRUSO = `intruso-cred-${sufixo}@exemplo.com`;
const usuarios: string[] = [];
let tokenOrg = '';
let tokenIntruso = '';
let numero = '';
let configOriginal: Record<string, unknown> | null = null;

async function entrar(email: string): Promise<SupabaseClient> {
  const { data, error } = await servico.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw error;
  const cliente = createClient(API, env.ANON_KEY, opcoes);
  const r = await cliente.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: 'magiclink',
  });
  if (r.error) throw r.error;
  return cliente;
}

async function checkIn(corpo: unknown, token = tokenOrg) {
  const headers: Record<string, string> = {
    apikey: env.ANON_KEY,
    'Content-Type': 'application/json',
    Origin: ORIGEM,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(FUNCAO, { method: 'POST', headers, body: JSON.stringify(corpo) });
  return { status: r.status, corpo: await r.json() };
}

beforeAll(async () => {
  if (SEGREDO_QR.length < 32) throw new Error('Defina QR_HMAC_SECRET em supabase/functions/.env');
  const { data: config } = await servico.from('config_evento').select('*').single();
  configOriginal = config;
  const agora = Date.now();
  await servico
    .from('config_evento')
    .update({
      inscricoes_inicio: new Date(agora - 86_400_000).toISOString(),
      inscricoes_fim: new Date(agora + 86_400_000).toISOString(),
    })
    .eq('id', true);

  const { data: insc, error } = await servico.rpc('register_participant', {
    p_nome: 'Participante Credenciamento',
    p_cpf: '529.982.247-25',
    p_email: `cred-${sufixo}@exemplo.com`,
    p_instituicao: null,
    p_minicursos: [],
    p_trabalho: null,
  });
  if (error) throw error;
  numero = insc[0].numero_inscricao;

  for (const email of [ORG, INTRUSO]) {
    const { data, error: e } = await servico.auth.admin.createUser({ email, email_confirm: true });
    if (e) throw e;
    usuarios.push(data.user.id);
  }
  await servico.from('organizadores').insert({ email: ORG });
  tokenOrg = (await (await entrar(ORG)).auth.getSession()).data.session!.access_token;
  tokenIntruso = (await (await entrar(INTRUSO)).auth.getSession()).data.session!.access_token;
});

afterAll(async () => {
  await servico.from('participantes').delete().eq('email', `cred-${sufixo}@exemplo.com`);
  await servico.from('organizadores').delete().eq('email', ORG);
  for (const id of usuarios) await servico.auth.admin.deleteUser(id);
  if (configOriginal) await servico.from('config_evento').update(configOriginal).eq('id', true);
});

describe('check-in com login real e QR assinado', () => {
  it('QR válido registra presença uma vez; repetir devolve "já registrado"', async () => {
    const token = await assinarInscricao(numero, SEGREDO_QR);
    const primeiro = await checkIn({ token, dia: '2026-12-02', modo: 'dia' });
    expect(primeiro.status).toBe(200);
    expect(primeiro.corpo).toEqual({
      resultado: 'ok',
      numero,
      nome: 'Participante Credenciamento',
    });

    const segundo = await checkIn({ token, dia: '2026-12-02', modo: 'dia' });
    expect(segundo.corpo.resultado).toBe('ja_registrado');
  });

  it('QR adulterado (outro número com a mesma assinatura) é recusado', async () => {
    const token = await assinarInscricao(numero, SEGREDO_QR);
    const [, assinatura] = token.split('.');
    const r = await checkIn({ token: `ICML26-9999.${assinatura}`, dia: '2026-12-02', modo: 'dia' });
    expect(r.corpo).toEqual({ resultado: 'qr_invalido' });
  });

  it('QR assinado com outro segredo é recusado', async () => {
    const token = await assinarInscricao(numero, 'segredo-de-um-atacante-com-32-caracteres!!');
    const r = await checkIn({ token, dia: '2026-12-03', modo: 'dia' });
    expect(r.corpo).toEqual({ resultado: 'qr_invalido' });
  });

  it('busca manual pelo número funciona para o organizador', async () => {
    const r = await checkIn({ numero: numero.toLowerCase(), dia: '2026-12-03', modo: 'dia' });
    expect(r.corpo.resultado).toBe('ok');
  });

  it('modo Minicurso avisa quem não está inscrito', async () => {
    const r = await checkIn({ numero, dia: '2026-12-02', modo: 'minicurso' });
    expect(r.corpo.resultado).toBe('nao_inscrito_minicurso');
  });

  it('dia fora do evento é recusado', async () => {
    const r = await checkIn({ numero, dia: '2026-12-10', modo: 'dia' });
    expect(r.corpo.resultado).toBe('dia_invalido');
  });

  it('sem login → 401; logado fora da lista → 403; token falso → 401', async () => {
    expect((await checkIn({ numero, dia: '2026-12-04', modo: 'dia' }, '')).status).toBe(401);
    expect((await checkIn({ numero, dia: '2026-12-04', modo: 'dia' }, tokenIntruso)).status).toBe(
      403,
    );
    expect((await checkIn({ numero, dia: '2026-12-04', modo: 'dia' }, 'a.b.c')).status).toBe(401);
    expect((await checkIn({ numero, dia: '2026-12-04', modo: 'dia' }, env.ANON_KEY)).status).toBe(
      401,
    );
    const { count } = await servico
      .from('presencas')
      .select('*', { count: 'exact', head: true })
      .eq('dia', '2026-12-04');
    expect(count).toBe(0);
  });

  it('presença aparece no painel do organizador', async () => {
    const org = createClient(API, env.ANON_KEY, {
      ...opcoes,
      global: { headers: { Authorization: `Bearer ${tokenOrg}` } },
    });
    const { data, error } = await org.rpc('admin_listar_inscricoes');
    expect(error).toBeNull();
    const linha = (data as { numero: string; dias_presente: string[] }[]).find(
      (l) => l.numero === numero,
    );
    expect(linha?.dias_presente).toEqual(['2026-12-02', '2026-12-03']);
  });
});
