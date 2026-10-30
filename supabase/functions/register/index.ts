// Edge Function `register` (WML-26/27): única porta de escrita pública do sistema.
// Ordem: limite por origem → Turnstile → consentimento → PDF (assinatura %PDF) → upload →
// RPC register_participant (transação + vagas, ADR-003) → grava o caminho do PDF.
// Regra LGPD: nada de CPF, nome ou e-mail em logs.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { erroSeguro } from '../_shared/erro-seguro.ts';
import { criarVerificadorDeOrigem } from '../_shared/origens.ts';
import { assinarInscricao } from '../_shared/qr.ts';

const PDF_MAX_BYTES = 5 * 1024 * 1024;
const MINICURSO_SLUG = 'ml-na-pratica';
const JANELA_LIMITE_SEGUNDOS = 600;
const LIMITE_MAX = Number(Deno.env.get('RATE_LIMIT_MAX') ?? '10');
const origemPermitida = criarVerificadorDeOrigem(Deno.env.get('ALLOWED_ORIGINS') ?? '');

type Resposta = { status: number; erro: string; campo?: string };

// Códigos de negócio do banco (SQLSTATE P0001) → mensagem para o participante.
const ERROS: Record<string, Resposta> = {
  INSCRICOES_FECHADAS: { status: 409, erro: 'As inscrições não estão abertas no momento.' },
  SUBMISSOES_FECHADAS: {
    status: 409,
    erro: 'O período de submissão de trabalhos está fechado. Desmarque o envio de trabalho para se inscrever.',
    campo: 'trabalho',
  },
  NOME_INVALIDO: { status: 422, erro: 'Informe nome e sobrenome, só com letras.', campo: 'nome' },
  CPF_INVALIDO: { status: 422, erro: 'CPF inválido. Confira os números.', campo: 'cpf' },
  EMAIL_INVALIDO: { status: 422, erro: 'Informe um e-mail válido.', campo: 'email' },
  EMAIL_JA_INSCRITO: {
    status: 409,
    erro: 'Este e-mail já tem inscrição. Se errou algum dado, fale com a organização.',
    campo: 'email',
  },
  MINICURSO_ESGOTADO: {
    status: 409,
    erro: 'As vagas do minicurso acabaram. Desmarque o minicurso para concluir a inscrição.',
    campo: 'minicurso',
  },
  MINICURSO_FECHADO: {
    status: 409,
    erro: 'As inscrições no minicurso ainda não abriram. Desmarque o minicurso para continuar.',
    campo: 'minicurso',
  },
  CPF_JA_NO_MINICURSO: {
    status: 409,
    erro: 'Este CPF já tem vaga no minicurso.',
    campo: 'minicurso',
  },
  NIVEL_OBRIGATORIO: { status: 422, erro: 'Escolha a categoria para concorrer.', campo: 'nivel' },
  VINCULO_INVALIDO: {
    status: 422,
    erro: 'Escolha seu vínculo: graduação, mestrado ou outro.',
    campo: 'vinculo',
  },
  CURSO_INVALIDO: {
    status: 422,
    erro: 'O curso deve ter no máximo 120 caracteres.',
    campo: 'curso',
  },
  PERFIL_INVALIDO: {
    status: 422,
    erro: 'Use o link do seu perfil no LinkedIn (linkedin.com/in/…) ou no Lattes (lattes.cnpq.br/…).',
    campo: 'perfil',
  },
  TRABALHO_INVALIDO: {
    status: 422,
    erro: 'Confira título, autores e resumo do trabalho.',
    campo: 'titulo',
  },
};

/** Causa do erro para o log: código + começo da mensagem, sem e-mail/CPF (o banco pode ecoar valores). */
function causa(e: { code?: string; message?: string } | null | undefined): string {
  return `${e?.code ?? 'sem-codigo'} ${erroSeguro(e?.message ?? '').slice(0, 120)}`;
}

function cabecalhos(origem: string): HeadersInit {
  const base: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  if (origemPermitida(origem)) base['Access-Control-Allow-Origin'] = origem;
  return base;
}

function json(status: number, corpo: unknown, h: HeadersInit): Response {
  return new Response(JSON.stringify(corpo), { status, headers: h });
}

// Verificado no pentest (S3, docs/seguranca/PENTEST-MVP.md): a Cloudflare na frente do Supabase
// barra cf-connecting-ip vindo do cliente, e x-real-ip/x-forwarded-for falsos não mudam o IP usado.
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
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST') return json(405, { erro: 'Método não permitido.' }, h);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json(400, { erro: 'Requisição inválida.' }, h);
  }
  const texto = (campo: string) => {
    const v = form.get(campo);
    return typeof v === 'string' ? v.trim() : '';
  };

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // 1. Limite por origem (conta toda tentativa, válida ou não).
  const ip = ipCliente(req);
  const chave = await sha256(`${Deno.env.get('RATE_LIMIT_SALT') ?? ''}:${ip}`);
  const { data: permitido, error: erroLimite } = await admin.rpc('consumir_limite', {
    p_chave: chave,
    p_max: LIMITE_MAX,
    p_janela_segundos: JANELA_LIMITE_SEGUNDOS,
  });
  if (erroLimite) {
    console.error('consumir_limite falhou', causa(erroLimite));
    return json(500, { erro: 'Erro inesperado. Tente novamente em instantes.' }, h);
  }
  if (!permitido) {
    return json(429, { erro: 'Muitas tentativas. Aguarde alguns minutos e tente de novo.' }, h);
  }

  // 2. Anti-robô.
  if (!(await turnstileValido(texto('cf-turnstile-response'), ip))) {
    return json(
      403,
      {
        erro: 'Não foi possível confirmar que você não é um robô. Recarregue a página e tente de novo.',
      },
      h,
    );
  }

  // 3. Consentimento LGPD.
  if (texto('consentimento') !== 'sim') {
    return json(
      422,
      { erro: 'É preciso concordar com a Política de Privacidade.', campo: 'consentimento' },
      h,
    );
  }

  // 3b. Vínculo (obrigatório para o crachá). Formato de curso e perfil: o banco valida.
  if (!['graduacao', 'mestrado', 'outro'].includes(texto('vinculo'))) {
    const { status, erro, campo } = ERROS.VINCULO_INVALIDO;
    return json(status, { erro, campo }, h);
  }

  // 4. Minicurso (opt-in).
  let minicursos: number[] = [];
  if (texto('minicurso') === 'sim') {
    const { data, error } = await admin
      .from('minicursos')
      .select('id')
      .eq('slug', MINICURSO_SLUG)
      .single();
    if (error || !data) {
      console.error('minicurso não encontrado', causa(error));
      return json(500, { erro: 'Erro inesperado. Tente novamente em instantes.' }, h);
    }
    minicursos = [data.id];
  }

  // 5. Trabalho + PDF (validado pelo conteúdo, não pela extensão).
  let trabalho: Record<string, unknown> | null = null;
  let pdf: File | null = null;
  if (texto('trabalho') === 'sim') {
    trabalho = {
      titulo: texto('titulo'),
      autores: texto('autores'),
      resumo: texto('resumo'),
      premio: texto('premio') === 'sim',
      nivel: texto('nivel') || null,
    };
    const arquivo = form.get('pdf');
    if (!(arquivo instanceof File) || arquivo.size === 0) {
      return json(422, { erro: 'Anexe o PDF do trabalho.', campo: 'pdf' }, h);
    }
    if (arquivo.size > PDF_MAX_BYTES) {
      return json(413, { erro: 'O PDF deve ter no máximo 5 MB.', campo: 'pdf' }, h);
    }
    const assinatura = new TextDecoder().decode(
      new Uint8Array(await arquivo.slice(0, 5).arrayBuffer()),
    );
    if (assinatura !== '%PDF-') {
      return json(422, { erro: 'Envie o trabalho em formato PDF.', campo: 'pdf' }, h);
    }
    pdf = arquivo;
  }

  // 6. Upload com caminho gerado no servidor; removido se a inscrição falhar.
  let caminho: string | null = null;
  if (pdf) {
    caminho = `${crypto.randomUUID()}.pdf`;
    const { error } = await admin.storage
      .from('trabalhos')
      .upload(caminho, pdf, { contentType: 'application/pdf', upsert: false });
    if (error) {
      console.error('upload do PDF falhou', causa(error));
      return json(500, { erro: 'Não foi possível enviar o PDF. Tente novamente.' }, h);
    }
  }

  // 7. Inscrição (transação única no banco).
  const { data, error } = await admin.rpc('register_participant', {
    p_nome: texto('nome'),
    p_cpf: texto('cpf'),
    p_email: texto('email'),
    p_instituicao: texto('instituicao') || null,
    p_minicursos: minicursos,
    p_trabalho: trabalho,
    p_vinculo: texto('vinculo'),
    p_curso: texto('curso') || null,
    p_perfil: texto('perfil') || null,
  });
  if (error) {
    if (caminho) await admin.storage.from('trabalhos').remove([caminho]);
    const conhecido = ERROS[error.message];
    if (conhecido) {
      return json(
        conhecido.status,
        { erro: conhecido.erro, codigo: error.message, campo: conhecido.campo },
        h,
      );
    }
    console.error('register_participant falhou', causa(error));
    return json(500, { erro: 'Erro inesperado. Tente novamente em instantes.' }, h);
  }

  const inscricao = data[0] as { id_inscricao: string; numero_inscricao: string };
  if (caminho) {
    const { error: erroCaminho } = await admin
      .from('trabalhos')
      .update({ pdf_path: caminho })
      .eq('participante_id', inscricao.id_inscricao);
    if (erroCaminho) console.error('gravar pdf_path falhou', causa(erroCaminho));
  }

  // Token do QR (o mesmo do comprovante): a tela de confirmação mostra o QR que o leitor aceita.
  // É a credencial da própria pessoa, sem dado pessoal; sem segredo configurado, vai só o número.
  let qr: string | undefined;
  try {
    const segredoQr = Deno.env.get('QR_HMAC_SECRET') ?? '';
    if (segredoQr) qr = await assinarInscricao(inscricao.numero_inscricao, segredoQr);
  } catch (e) {
    console.error('assinar QR falhou', erroSeguro(e));
  }
  return json(
    201,
    qr ? { numero: inscricao.numero_inscricao, qr } : { numero: inscricao.numero_inscricao },
    h,
  );
});
