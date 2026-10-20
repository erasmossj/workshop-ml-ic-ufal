// Integração da Edge Function `expurgo` (WML-52 · S6) contra o Supabase LOCAL.
// Os prazos (2027 e 2031) ainda não venceram: a função roda e não apaga nada. A lógica por data é
// coberta no pgTAP (expurgo.test.sql) e nos testes de unidade (_shared/expurgo.test.ts).
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

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
const arquivoEnv = existsSync('supabase/functions/.env')
  ? 'supabase/functions/.env'
  : 'supabase/functions/.env.example';
const SEGREDO = readFileSync(arquivoEnv, 'utf8')
  .match(/^SEND_EMAILS_SECRET=(.+)$/m)?.[1]
  ?.trim();
const FUNCAO = `${API}/functions/v1/expurgo`;

describe('Edge Function expurgo', () => {
  it('recusa chamada sem o segredo do cron', async () => {
    expect((await fetch(FUNCAO, { method: 'POST' })).status).toBe(401);
    const errado = await fetch(FUNCAO, {
      method: 'POST',
      headers: { 'x-cron-secret': 'x'.repeat(40) },
    });
    expect(errado.status).toBe(401);
  });

  it('antes dos prazos não apaga nada', async () => {
    const r = await fetch(FUNCAO, { method: 'POST', headers: { 'x-cron-secret': SEGREDO! } });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ pdfs: 0, dados_pessoais: 0, participantes: 0 });
  });
});
