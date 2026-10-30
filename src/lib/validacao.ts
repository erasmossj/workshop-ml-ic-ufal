/** Validações compartilhadas entre o formulário e (futuramente) a Edge Function `register`. */

export const PDF_MAX_BYTES = 5 * 1024 * 1024;
export const RESUMO_MAX = 1500;

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const NOME_RE = /^[\p{L}][\p{L}'’-]*$/u;

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function emailValido(email: string): boolean {
  const e = normalizarEmail(email);
  return e.length <= 254 && EMAIL_RE.test(e);
}

/** Pelo menos nome e sobrenome; letras (com acento), hífen e apóstrofo. */
export function nomeCompletoValido(nome: string): boolean {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  return nome.trim().length <= 120 && partes.length >= 2 && partes.every((p) => NOME_RE.test(p));
}

type ArquivoInfo = { name: string; size: number; type: string };

/**
 * Valida o PDF do trabalho. `primeirosBytes` são os bytes iniciais do arquivo:
 * a extensão sozinha não basta, exigimos a assinatura `%PDF-`.
 * Retorna a mensagem de erro ou `null` se estiver tudo certo.
 */
export function validarPdf(arquivo: ArquivoInfo, primeirosBytes: Uint8Array): string | null {
  const pareceSerPdf =
    arquivo.type === 'application/pdf' || arquivo.name.toLowerCase().endsWith('.pdf');
  const assinatura = new TextDecoder().decode(primeirosBytes.slice(0, 5));
  if (!pareceSerPdf || assinatura !== '%PDF-') return 'Envie o trabalho em formato PDF.';
  if (arquivo.size > PDF_MAX_BYTES) return 'O PDF deve ter no máximo 5 MB.';
  return null;
}

/** Vínculo com a instituição (Figma: Choice "Vínculo"; Tag do crachá). */
export const VINCULOS = [
  { valor: 'graduacao', rotulo: 'Graduação' },
  { valor: 'mestrado', rotulo: 'Mestrado' },
  { valor: 'outro', rotulo: 'Outro' },
] as const;
export type Vinculo = (typeof VINCULOS)[number]['valor'];

export const CURSO_MAX = 120;

const LINKEDIN_RE = /^(?:[a-z]{2,3}\.|www\.)?linkedin\.com\/in\/([A-Za-z0-9_%-]{3,100})$/i;
const LATTES_RE = /^(?:www\.)?lattes\.cnpq\.br\/(\d{16})$/i;

/**
 * Perfil LinkedIn ou Lattes que vira QR no crachá (WML-69). Devolve o link canônico em https,
 * '' para campo vazio ou null se não for um perfil desses dois sites — o QR impresso nunca aponta
 * para outro domínio. Mesmas regras de public.normalizar_perfil() no banco.
 */
export function normalizarPerfil(url: string): string | null {
  let v = url.trim();
  if (!v) return '';
  v = v
    .replace(/^https?:\/\//i, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
  const linkedin = LINKEDIN_RE.exec(v);
  if (linkedin) return `https://www.linkedin.com/in/${linkedin[1]}`;
  const lattes = LATTES_RE.exec(v);
  if (lattes) return `https://lattes.cnpq.br/${lattes[1]}`;
  return null;
}

/** `inicio`/`fim` em ISO com fuso (ex.: 2026-10-30T00:00:00-03:00). Limites inclusivos. */
export function dentroDaJanela(agora: Date, inicio: string, fim: string): boolean {
  const t = agora.getTime();
  return t >= new Date(inicio).getTime() && t <= new Date(fim).getTime();
}
