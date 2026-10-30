// Integração do painel (WML-32/33) contra o Supabase LOCAL com login de verdade (magic link):
// o JWT emitido pelo Auth precisa passar pela allowlist `organizadores` nas RPCs e no Storage.
// Pré-requisito: `npm run db:start`. Usuários sintéticos, criados e apagados aqui.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

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
const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
const servico = createClient(API, env.SERVICE_ROLE_KEY, opcoes);

const sufixo = Date.now();
const ORG = `org-${sufixo}@exemplo.com`;
const INTRUSO = `intruso-${sufixo}@exemplo.com`;
const PDF = `integracao-admin-${sufixo}.pdf`;
const ids: string[] = [];

/** Entra pelo mesmo caminho do magic link (token do e-mail → verifyOtp). */
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

let org: SupabaseClient;
let intruso: SupabaseClient;

beforeAll(async () => {
  for (const email of [ORG, INTRUSO]) {
    const { data, error } = await servico.auth.admin.createUser({ email, email_confirm: true });
    if (error) throw error;
    ids.push(data.user.id);
  }
  const { error } = await servico.from('organizadores').insert({ email: ORG });
  if (error) throw error;
  await servico.storage
    .from('trabalhos')
    .upload(PDF, new Blob(['%PDF-1.4\n%%EOF'], { type: 'application/pdf' }));
  org = await entrar(ORG);
  intruso = await entrar(INTRUSO);
});

afterAll(async () => {
  await servico.storage.from('trabalhos').remove([PDF]);
  await servico.from('organizadores').delete().eq('email', ORG);
  for (const id of ids) await servico.auth.admin.deleteUser(id);
});

describe('painel da organização com login real', () => {
  it('organizador lê a configuração e a lista', async () => {
    const config = await org.rpc('admin_obter_config');
    expect(config.error).toBeNull();
    expect(config.data.minicursos.length).toBeGreaterThan(0);
    const lista = await org.rpc('admin_listar_inscricoes');
    expect(lista.error).toBeNull();
    expect(Array.isArray(lista.data)).toBe(true);
    // (?<!\d): um ID Lattes (16 dígitos, WML-69) não é CPF; qualquer CPF de 11 dígitos é.
    expect(JSON.stringify(lista.data)).not.toMatch(/(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}"/);
  });

  it('usuário autenticado fora da allowlist é recusado', async () => {
    for (const rpc of ['admin_obter_config', 'admin_listar_inscricoes', 'admin_resumo_emails']) {
      const { error } = await intruso.rpc(rpc);
      expect(error?.message, rpc).toBe('NAO_AUTORIZADO');
    }
  });

  it('só o organizador gera URL assinada do PDF, e ela funciona', async () => {
    const { data, error } = await org.storage.from('trabalhos').createSignedUrl(PDF, 60);
    expect(error).toBeNull();
    const r = await fetch(data!.signedUrl);
    expect(r.status).toBe(200);
    expect((await r.text()).startsWith('%PDF')).toBe(true);

    const negado = await intruso.storage.from('trabalhos').createSignedUrl(PDF, 60);
    expect(negado.data).toBeNull();
    expect(negado.error).not.toBeNull();
  });

  it('pedir link com e-mail desconhecido não cria conta', async () => {
    const anonimo = createClient(API, env.ANON_KEY, opcoes);
    const desconhecido = `desconhecido-${sufixo}@exemplo.com`;
    await anonimo.auth.signInWithOtp({
      email: desconhecido,
      options: { shouldCreateUser: false },
    });
    const { data } = await servico.auth.admin.listUsers({ perPage: 1000 });
    expect(data.users.some((u) => u.email === desconhecido)).toBe(false);
  });
});
