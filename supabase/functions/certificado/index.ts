// Edge Function `certificado` (WML-60 · ADR-005): o participante baixa o certificado com e-mail +
// nº de inscrição. Protegida por limite por origem e Turnstile, como a `register`. O PDF é montado
// na hora sobre o modelo (nada é guardado). CPF completo só dentro do PDF; nada pessoal em logs.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { gerarCertificado, type Campos } from '../_shared/certificado.ts';
import { baixarCertificado, type DadosParaPdf } from '../_shared/download-certificado.ts';
import { erroSeguro } from '../_shared/erro-seguro.ts';
import { criarVerificadorDeOrigem } from '../_shared/origens.ts';

const JANELA_LIMITE_SEGUNDOS = 600;
const LIMITE_MAX = Number(Deno.env.get('CERT_RATE_LIMIT_MAX') ?? '10');
const origemPermitida = criarVerificadorDeOrigem(Deno.env.get('ALLOWED_ORIGINS') ?? '');

function cabecalhos(origem: string): Record<string, string> {
  const base: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Cache-Control': 'no-store',
    Vary: 'Origin',
  };
  if (origemPermitida(origem)) base['Access-Control-Allow-Origin'] = origem;
  return base;
}

// Mesma lógica da `register` (verificada no pentest S3): a Cloudflare barra cf-connecting-ip forjado.
function ipCliente(req: Request): string {
  return (
    req.headers.get('cf-connecting-ip') ??
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'desconhecido'
  );
}

async function sha256(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function turnstileValido(token: string, ip: string): Promise<boolean> {
  const segredo = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!segredo || !token) return false;
  const corpo = new FormData();
  corpo.append('secret', segredo);
  corpo.append('response', token);
  if (ip !== 'desconhecido') corpo.append('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: corpo,
    });
    return (await r.json()).success === true;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  const h = cabecalhos(req.headers.get('origin') ?? '');
  const json = (status: number, corpo: unknown) =>
    new Response(JSON.stringify(corpo), {
      status,
      headers: { ...h, 'Content-Type': 'application/json; charset=utf-8' },
    });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json(405, { erro: 'Método não permitido.' });

  let corpo: unknown = null;
  try {
    corpo = await req.json();
  } catch {
    // corpo inválido → 422 em baixarCertificado
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
  const ip = ipCliente(req);
  const site = (Deno.env.get('SITE_URL') ?? '').replace(/\/$/, '');

  const r = await baixarCertificado(corpo, {
    async consumirLimite() {
      const chave = await sha256(`${Deno.env.get('RATE_LIMIT_SALT') ?? ''}:certificado:${ip}`);
      const { data, error } = await admin.rpc('consumir_limite', {
        p_chave: chave,
        p_max: LIMITE_MAX,
        p_janela_segundos: JANELA_LIMITE_SEGUNDOS,
      });
      if (error) throw new Error(`consumir_limite ${error.code ?? ''}`);
      return data === true;
    },
    turnstileValido: (token) => turnstileValido(token, ip),
    async buscar(email, numero) {
      const { data, error } = await admin.rpc('certificado_para_download', {
        p_email: email,
        p_numero: numero,
      });
      if (error) throw new Error(`certificado_para_download ${error.code ?? ''}`);
      return ((data as DadosParaPdf[]) ?? [])[0] ?? null;
    },
    async gerar(dados) {
      if (!site) throw new Error('SITE_URL_AUSENTE');
      const { data: cfg, error } = await admin
        .from('config_certificado')
        .select('template_path, campos')
        .single();
      if (error || !cfg?.template_path || !cfg.campos) throw new Error('MODELO_INCOMPLETO');
      const { data: arquivo, error: erroArquivo } = await admin.storage
        .from('certificados')
        .download(cfg.template_path);
      if (erroArquivo || !arquivo) throw new Error('MODELO_INDISPONIVEL');
      return gerarCertificado(new Uint8Array(await arquivo.arrayBuffer()), cfg.campos as Campos, {
        nome: dados.nome,
        cpf: dados.cpf,
        minutos: dados.minutos,
        codigo: dados.codigo,
        urlValidacao: `${site}/validar`,
      });
    },
  }).catch((e) => {
    console.error('certificado falhou', erroSeguro(e));
    return {
      status: 500,
      tipo: 'json' as const,
      corpo: { erro: 'Erro inesperado. Tente novamente em instantes.' },
    };
  });

  if (r.tipo === 'pdf') {
    return new Response(r.pdf, {
      status: 200,
      headers: {
        ...h,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${r.arquivo}"`,
        'Access-Control-Expose-Headers': 'Content-Disposition',
      },
    });
  }
  return json(r.status, r.corpo);
});
