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

/** `inicio`/`fim` em ISO com fuso (ex.: 2026-10-30T00:00:00-03:00). Limites inclusivos. */
export function dentroDaJanela(agora: Date, inicio: string, fim: string): boolean {
  const t = agora.getTime();
  return t >= new Date(inicio).getTime() && t <= new Date(fim).getTime();
}
