// Integração dos certificados (WML-57..60 · S5) contra o Supabase LOCAL: o organizador sobe o
// modelo, salva as posições e libera; o participante baixa o PDF; o e-mail chega com o anexo.
// Pré-requisito: `npm run db:start` e `npm run functions:serve`. Dados 100% sintéticos.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
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
const MAILPIT = env.INBUCKET_URL ?? env.MAILPIT_URL ?? 'http://127.0.0.1:54324';
const arquivoEnv = existsSync('supabase/functions/.env')
  ? 'supabase/functions/.env'
  : 'supabase/functions/.env.example';
const SEGREDO_CRON = readFileSync(arquivoEnv, 'utf8')
  .match(/^SEND_EMAILS_SECRET=(.+)$/m)?.[1]
  ?.trim();
const opcoes = { auth: { persistSession: false, autoRefreshToken: false } };
const servico = createClient(API, env.SERVICE_ROLE_KEY, opcoes);
const FUNCAO = `${API}/functions/v1/certificado`;
const TURNSTILE_TESTE = 'XXXX.DUMMY.TOKEN.XXXX'; // chave de teste da Cloudflare sempre aprova

const sufixo = Date.now();
const ORG = `org-cert-${sufixo}@exemplo.com`;
const EMAIL = `cert-${sufixo}@exemplo.com`;
const MODELO = crypto.randomUUID() + '.pdf';
let usuario = '';
let numero = '';
let org: SupabaseClient;
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

const baixar = (corpo: Record<string, string>) =>
  fetch(FUNCAO, {
    method: 'POST',
    headers: { apikey: env.ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });

async function esperar<T>(buscar: () => Promise<T | undefined>, ms = 30_000): Promise<T> {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    const v = await buscar();
    if (v !== undefined) return v;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error('tempo esgotado');
}

beforeAll(async () => {
  const { data: config } = await servico.from('config_evento').select('*').single();
  configOriginal = config;
  const agora = Date.now();
  await servico
    .from('config_evento')
    .update({
      inscricoes_inicio: new Date(agora - 86_400_000).toISOString(),
      inscricoes_fim: new Date(agora + 86_400_000).toISOString(),
      limite_diario_email: 1000,
    })
    .eq('id', true);

  const insc = await servico.rpc('register_participant', {
    p_nome: 'Participante Certificado Integração',
    p_cpf: '529.982.247-25',
    p_email: EMAIL,
    p_instituicao: null,
    p_minicursos: [],
    p_trabalho: null,
  });
  if (insc.error) throw insc.error;
  numero = insc.data[0].numero_inscricao;

  const u = await servico.auth.admin.createUser({ email: ORG, email_confirm: true });
  if (u.error) throw u.error;
  usuario = u.data.user.id;
  await servico.from('organizadores').insert({ email: ORG });
  org = await entrar(ORG);
  await servico.rpc('check_in', {
    p_numero: numero,
    p_dia: '2026-12-02',
    p_minicurso: null,
    p_origem: 'manual',
    p_operador: ORG,
  });
});

afterAll(async () => {
  await servico.from('participantes').delete().eq('email', EMAIL);
  await servico.storage.from('certificados').remove([MODELO]);
  await servico
    .from('config_certificado')
    .update({ template_path: null, campos: null, atualizado_em: null })
    .eq('id', true);
  await servico.from('organizadores').delete().eq('email', ORG);
  if (usuario) await servico.auth.admin.deleteUser(usuario);
  if (configOriginal) await servico.from('config_evento').update(configOriginal).eq('id', true);
});

describe('certificados de ponta a ponta', () => {
  it('organizador sobe o modelo, salva as posições e libera', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([841.89, 595.28]);
    const envio = await org.storage.from('certificados').upload(
      MODELO,
      new Blob([new Uint8Array(await pdf.save()).slice().buffer as ArrayBuffer], {
        type: 'application/pdf',
      }),
    );
    expect(envio.error).toBeNull();

    const campo = { pagina: 0, x: 120, y: 250, largura: 600, tamanho: 24 };
    const salvar = await org.rpc('admin_salvar_modelo_certificado', {
      p_template_path: MODELO,
      p_campos: {
        nome: { ...campo, alinhamento: 'centro', fonte: 'helvetica-negrito' },
        cpf: { ...campo, y: 300, tamanho: 14, alinhamento: 'centro', fonte: 'helvetica' },
        horas: { ...campo, y: 330, tamanho: 14, alinhamento: 'centro', fonte: 'helvetica' },
      },
    });
    expect(salvar.error).toBeNull();

    const liberar = await org.rpc('admin_liberar_certificados');
    expect(liberar.error).toBeNull();
    expect(liberar.data.emitidos).toBeGreaterThanOrEqual(1);
  });

  it('participante baixa o PDF com e-mail + número', async () => {
    const r = await baixar({ email: EMAIL.toUpperCase(), numero, turnstile: TURNSTILE_TESTE });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('application/pdf');
    expect(r.headers.get('content-disposition')).toContain(`certificado-${numero}.pdf`);
    const bytes = new Uint8Array(await r.arrayBuffer());
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getSubject()).toMatch(/^Código de validação [0-9A-Z-]{23}$/);
  });

  it('dados errados têm a mesma resposta de "não liberado"', async () => {
    const r = await baixar({ email: EMAIL, numero: 'ICML26-9999', turnstile: TURNSTILE_TESTE });
    expect(r.status).toBe(404);
    expect((await r.json()).erro).toMatch(/liberad/);
  });

  it('sem anti-robô é recusado', async () => {
    const r = await baixar({ email: EMAIL, numero, turnstile: '' });
    expect(r.status).toBe(422);
  });

  it('validação pública por código funciona com a chave anônima', async () => {
    const { data: cert } = await servico
      .from('certificados')
      .select('codigo, participante_id, participantes!inner(email)')
      .eq('participantes.email', EMAIL)
      .single();
    const anonimo = createClient(API, env.ANON_KEY, opcoes);
    const { data, error } = await anonimo.rpc('validar_certificado', { p_codigo: cert!.codigo });
    expect(error).toBeNull();
    expect(data[0]).toMatchObject({
      nome: 'Participante Certificado Integração',
      cpf_mascarado: '***.982.247-**',
      minutos: 180,
    });
  });

  it('e-mail do certificado chega com o PDF anexado', async () => {
    await fetch(`${API}/functions/v1/send-emails`, {
      method: 'POST',
      headers: { 'x-cron-secret': SEGREDO_CRON! },
    });
    const mensagem = await esperar(async () => {
      const busca = await fetch(
        `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${EMAIL} subject:certificado`)}`,
      );
      return (await busca.json()).messages?.[0];
    });
    expect(mensagem.Subject).toBe(`IC-ML 2026 · Seu certificado · ${numero}`);
    const completa = await (await fetch(`${MAILPIT}/api/v1/message/${mensagem.ID}`)).json();
    expect(completa.Attachments.map((a: { FileName: string }) => a.FileName)).toEqual([
      `certificado-${numero}.pdf`,
    ]);
    expect(completa.Text).not.toMatch(/529\.?982\.?247-?25/);
  });
});
