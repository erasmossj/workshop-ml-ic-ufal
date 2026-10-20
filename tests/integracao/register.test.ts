// Integração da Edge Function `register` (WML-26/27) contra o Supabase LOCAL.
// Pré-requisito: `npm run db:start` e `npm run functions:serve`. Dados 100% sintéticos.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { verificarToken } from '../../supabase/functions/_shared/qr';

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
const SERVICO = env.SERVICE_ROLE_KEY;
const PUBLICA = env.ANON_KEY;
const FUNCAO = `${API}/functions/v1/register`;
const SEGREDO_QR =
  readFileSync('supabase/functions/.env', 'utf8')
    .match(/^QR_HMAC_SECRET=(.+)$/m)?.[1]
    ?.trim() ?? '';
const sufixo = Date.now();
let contador = 0;
const novoEmail = () => `integracao-${sufixo}-${contador++}@exemplo.com`;

const comServico = { apikey: SERVICO, Authorization: `Bearer ${SERVICO}` };
const rest = (caminho: string, init: RequestInit = {}) =>
  fetch(`${API}/rest/v1/${caminho}`, {
    ...init,
    headers: { ...comServico, 'Content-Type': 'application/json', ...init.headers },
  });

const PDF_VALIDO = new Blob(['%PDF-1.4\n1 0 obj<<>>endobj\n%%EOF'], { type: 'application/pdf' });

function formulario(campos: Record<string, string | Blob> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string | Blob> = {
    nome: 'Participante Integração',
    cpf: '529.982.247-25',
    email: novoEmail(),
    consentimento: 'sim',
    'cf-turnstile-response': 'XXXX.DUMMY.TOKEN.XXXX',
    ...campos,
  };
  for (const [k, v] of Object.entries(base)) {
    if (v instanceof Blob) fd.append(k, v, 'trabalho.pdf');
    else fd.append(k, v);
  }
  return fd;
}

async function enviar(fd: FormData) {
  const r = await fetch(FUNCAO, { method: 'POST', headers: { apikey: PUBLICA }, body: fd });
  return { status: r.status, corpo: await r.json(), texto: '' };
}

const trabalho = (extra: Record<string, string | Blob> = {}) => ({
  trabalho: 'sim',
  titulo: 'Classificação de imagens com CNNs',
  autores: 'Participante Integração',
  resumo: 'Resumo sintético usado apenas nos testes de integração.',
  pdf: PDF_VALIDO,
  ...extra,
});

async function contarObjetos(): Promise<number> {
  const r = await fetch(`${API}/storage/v1/object/list/trabalhos`, {
    method: 'POST',
    headers: { ...comServico, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefix: '', limit: 1000 }),
  });
  return (await r.json()).length;
}

beforeAll(async () => {
  const agora = Date.now();
  const janela = {
    inscricoes_inicio: new Date(agora - 86_400_000).toISOString(),
    inscricoes_fim: new Date(agora + 86_400_000).toISOString(),
    submissoes_inicio: new Date(agora - 86_400_000).toISOString(),
    submissoes_fim: new Date(agora + 86_400_000).toISOString(),
  };
  await rest('config_evento?id=eq.true', { method: 'PATCH', body: JSON.stringify(janela) });
  await rest('minicursos?slug=eq.ml-na-pratica', {
    method: 'PATCH',
    body: JSON.stringify({ vagas: 1000 }),
  });
});

beforeEach(async () => {
  await rest('limite_requisicoes?chave=not.is.null', { method: 'DELETE' });
});

describe('Edge Function register', () => {
  it('inscreve e devolve só o número e o token do QR (o mesmo do comprovante)', async () => {
    const { status, corpo } = await enviar(formulario());
    expect(status).toBe(201);
    expect(Object.keys(corpo).sort()).toEqual(['numero', 'qr']);
    expect(corpo.numero).toMatch(/^ICML26-\d{4}$/);
    // O QR da tela de confirmação precisa passar no leitor do credenciamento.
    expect(await verificarToken(corpo.qr, SEGREDO_QR)).toBe(corpo.numero);
    expect(JSON.stringify(corpo)).not.toContain('52998224725');
  });

  it('grava nome com acentos e cedilha em UTF-8, sem corromper', async () => {
    const email = novoEmail();
    const nome = 'Conceição Fumaça Araújo';
    expect((await enviar(formulario({ nome, email }))).status).toBe(201);
    const [gravado] = await (await rest(`participantes?select=nome&email=eq.${email}`)).json();
    expect(gravado.nome).toBe(nome);
  });

  it('recusa e-mail repetido com código e campo', async () => {
    const email = novoEmail();
    expect((await enviar(formulario({ email }))).status).toBe(201);
    const { status, corpo } = await enviar(formulario({ email: email.toUpperCase() }));
    expect(status).toBe(409);
    expect(corpo).toMatchObject({ codigo: 'EMAIL_JA_INSCRITO', campo: 'email' });
  });

  it('exige consentimento LGPD', async () => {
    const fd = formulario();
    fd.delete('consentimento');
    const { status, corpo } = await enviar(fd);
    expect(status).toBe(422);
    expect(corpo.campo).toBe('consentimento');
  });

  it('exige o token do Turnstile', async () => {
    const fd = formulario();
    fd.delete('cf-turnstile-response');
    expect((await enviar(fd)).status).toBe(403);
  });

  it('valida o CPF no servidor', async () => {
    const { status, corpo } = await enviar(formulario({ cpf: '529.982.247-24' }));
    expect(status).toBe(422);
    expect(corpo).toMatchObject({ codigo: 'CPF_INVALIDO', campo: 'cpf' });
  });

  it('salva o PDF do trabalho no bucket privado', async () => {
    const email = novoEmail();
    const { status } = await enviar(formulario({ email, ...trabalho() }));
    expect(status).toBe(201);
    const [linha] = await rest(
      `trabalhos?select=pdf_path,participantes!inner(email)&participantes.email=eq.${encodeURIComponent(email)}`,
    ).then((r) => r.json());
    expect(linha.pdf_path).toMatch(/^[0-9a-f-]{36}\.pdf$/);
    const comChave = await fetch(`${API}/storage/v1/object/trabalhos/${linha.pdf_path}`, {
      headers: comServico,
    });
    expect(comChave.status).toBe(200);
    const anonimo = await fetch(`${API}/storage/v1/object/public/trabalhos/${linha.pdf_path}`);
    expect(anonimo.status).not.toBe(200);
  });

  it('recusa arquivo renomeado para .pdf e não cria a inscrição', async () => {
    const email = novoEmail();
    const falso = new Blob(['MZ isto não é um pdf'], { type: 'application/pdf' });
    const { status, corpo } = await enviar(formulario({ email, ...trabalho({ pdf: falso }) }));
    expect(status).toBe(422);
    expect(corpo.campo).toBe('pdf');
    const linhas = await rest(`participantes?select=id&email=eq.${encodeURIComponent(email)}`).then(
      (r) => r.json(),
    );
    expect(linhas).toHaveLength(0);
  });

  it('recusa PDF acima de 5 MB (413) sem gravar nada', async () => {
    const email = novoEmail();
    const grande = new Blob(['%PDF-1.4\n', new Uint8Array(5 * 1024 * 1024)], {
      type: 'application/pdf',
    });
    const antes = await contarObjetos();
    const { status, corpo } = await enviar(formulario({ email, ...trabalho({ pdf: grande }) }));
    expect(status).toBe(413);
    expect(corpo.campo).toBe('pdf');
    expect(await contarObjetos()).toBe(antes);
    const linhas = await rest(`participantes?select=id&email=eq.${encodeURIComponent(email)}`).then(
      (r) => r.json(),
    );
    expect(linhas).toHaveLength(0);
  });

  it('recusa inscrição fora da janela, mesmo chamando a função direto', async () => {
    const [config] = await rest('config_evento?select=inscricoes_fim').then((r) => r.json());
    await rest('config_evento?id=eq.true', {
      method: 'PATCH',
      body: JSON.stringify({ inscricoes_fim: new Date(Date.now() - 60_000).toISOString() }),
    });
    try {
      const { status, corpo } = await enviar(formulario());
      expect(status).toBe(409);
      expect(corpo.codigo).toBe('INSCRICOES_FECHADAS');
    } finally {
      await rest('config_evento?id=eq.true', {
        method: 'PATCH',
        body: JSON.stringify({ inscricoes_fim: config.inscricoes_fim }),
      });
    }
  });

  it('minicurso esgotado: recusa e não deixa PDF órfão no bucket', async () => {
    const [mc] = await rest('minicursos?slug=eq.ml-na-pratica&select=ocupadas').then((r) =>
      r.json(),
    );
    await rest('minicursos?slug=eq.ml-na-pratica', {
      method: 'PATCH',
      body: JSON.stringify({ vagas: mc.ocupadas }),
    });
    const antes = await contarObjetos();
    const { status, corpo } = await enviar(
      formulario({ cpf: '390.533.447-05', minicurso: 'sim', ...trabalho() }),
    );
    expect(status).toBe(409);
    expect(corpo).toMatchObject({ codigo: 'MINICURSO_ESGOTADO', campo: 'minicurso' });
    expect(await contarObjetos()).toBe(antes);
    await rest('minicursos?slug=eq.ml-na-pratica', {
      method: 'PATCH',
      body: JSON.stringify({ vagas: 1000 }),
    });
  });

  it('bloqueia excesso de requisições da mesma origem (429)', async () => {
    const limite = 5; // RATE_LIMIT_MAX do supabase/functions/.env de desenvolvimento
    let ultimo = 0;
    for (let i = 0; i <= limite; i++) {
      const fd = formulario();
      fd.delete('consentimento'); // inválidas de propósito: o limite conta toda tentativa
      ultimo = (await enviar(fd)).status;
    }
    expect(ultimo).toBe(429);
  });
});

// CORS não é testado aqui: o Kong do Supabase local responde ao preflight sozinho com `*`.
// A regra fica em supabase/functions/_shared/origens.test.ts e é conferida no staging (preflight real).
