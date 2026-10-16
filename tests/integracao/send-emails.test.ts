// Integração da fila de e-mail (WML-29..31) contra o Supabase LOCAL: inscrição → send-emails →
// Mailpit. Pré-requisito: `npm run db:start` e `npm run functions:serve`. Dados 100% sintéticos.
// O pg_cron local também processa a fila a cada minuto; o teste aceita qualquer um dos dois.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

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
const MAILPIT = env.INBUCKET_URL ?? env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const SERVICO = env.SERVICE_ROLE_KEY;
const FUNCAO = `${API}/functions/v1/send-emails`;

const arquivoEnv = existsSync('supabase/functions/.env')
  ? 'supabase/functions/.env'
  : 'supabase/functions/.env.example';
const SEGREDO = readFileSync(arquivoEnv, 'utf8')
  .match(/^SEND_EMAILS_SECRET=(.+)$/m)?.[1]
  ?.trim();

const comServico = { apikey: SERVICO, Authorization: `Bearer ${SERVICO}` };
const rest = (caminho: string, init: RequestInit = {}) =>
  fetch(`${API}/rest/v1/${caminho}`, {
    ...init,
    headers: { ...comServico, 'Content-Type': 'application/json', ...init.headers },
  });

const disparar = (segredo?: string) =>
  fetch(FUNCAO, {
    method: 'POST',
    headers: segredo ? { 'x-cron-secret': segredo } : {},
  });

async function esperar<T>(buscar: () => Promise<T | undefined>, ms = 20_000): Promise<T> {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    const v = await buscar();
    if (v !== undefined) return v;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('tempo esgotado');
}

beforeAll(async () => {
  expect(SEGREDO, 'SEND_EMAILS_SECRET no supabase/functions/.env').toBeTruthy();
  const agora = Date.now();
  await rest('config_evento?id=eq.true', {
    method: 'PATCH',
    body: JSON.stringify({
      inscricoes_inicio: new Date(agora - 86_400_000).toISOString(),
      inscricoes_fim: new Date(agora + 86_400_000).toISOString(),
      limite_diario_email: 1000,
    }),
  });
});

describe('Edge Function send-emails', () => {
  it('recusa chamada sem o segredo do cron', async () => {
    expect((await disparar()).status).toBe(401);
    expect((await disparar('x'.repeat(SEGREDO!.length))).status).toBe(401);
  });

  it('envia a confirmação com comprovante e .ics e marca o item como enviado', async () => {
    const email = `integracao-email-${Date.now()}@exemplo.com`;
    const r = await rest('rpc/register_participant', {
      method: 'POST',
      body: JSON.stringify({
        p_nome: 'Participante Integração Email',
        p_cpf: '529.982.247-25',
        p_email: email,
        p_instituicao: null,
        p_minicursos: [],
        p_trabalho: null,
      }),
    });
    expect(r.status).toBe(200);
    const [{ numero_inscricao: numero }] = await r.json();

    const resposta = await disparar(SEGREDO);
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toMatchObject({ falhas: 0 });

    const mensagem = await esperar(async () => {
      const busca = await fetch(
        `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
      );
      return (await busca.json()).messages?.[0];
    });
    expect(mensagem.Subject).toBe(`IC-ML 2026 · Inscrição confirmada · ${numero}`);

    const completa = await (await fetch(`${MAILPIT}/api/v1/message/${mensagem.ID}`)).json();
    expect(completa.Attachments.map((a: { FileName: string }) => a.FileName)).toEqual([
      `comprovante-${numero}.pdf`,
      'ic-ml-2026.ics',
    ]);
    expect(completa.Text).toContain('***.982.247-**');
    expect(completa.Text).not.toContain('529.982.247-25');

    const fila = await esperar(async () => {
      const linhas = await (
        await rest(
          `email_outbox?select=status,provedor,participantes!inner(email)&participantes.email=eq.${email}`,
        )
      ).json();
      return linhas[0]?.status === 'enviado' ? linhas[0] : undefined;
    });
    expect(fila.provedor).toBe('gmail');
  });
});
