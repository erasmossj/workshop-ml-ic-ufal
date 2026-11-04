/** Validações compartilhadas entre o formulário e (futuramente) a Edge Function `register`. */

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

/** Vínculo com a instituição (Figma: Choice "Vínculo"; Tag do crachá). WML-72. */
export const VINCULOS = [
  { valor: 'estudante', rotulo: 'Estudante' },
  { valor: 'docente', rotulo: 'Docente' },
  { valor: 'outro', rotulo: 'Outro' },
] as const;
export type Vinculo = (typeof VINCULOS)[number]['valor'];

/** Tamanho máximo do texto livre do vínculo "Outro" (mesmo limite do banco e da Edge Function). */
export const VINCULO_OUTRO_MAX = 40;

/** Texto do "Outro" como o servidor grava: sem espaços nas pontas nem repetidos. */
export function normalizarVinculoOutro(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

/**
 * Vínculo escolhido + texto do "Outro" → erro (campo e mensagem) ou null.
 * Mesmas regras e mensagens da Edge Function `register`. Tamanho em caracteres (code points),
 * como o char_length() do banco.
 */
export function validarVinculo(
  vinculo: string,
  outro: string,
): { campo: 'vinculo' | 'vinculo_outro'; msg: string } | null {
  if (!VINCULOS.some((v) => v.valor === vinculo)) {
    return { campo: 'vinculo', msg: 'Escolha seu vínculo: estudante, docente ou outro.' };
  }
  if (vinculo !== 'outro') return null;
  const texto = normalizarVinculoOutro(outro);
  return texto && [...texto].length <= VINCULO_OUTRO_MAX
    ? null
    : {
        campo: 'vinculo_outro',
        msg: `Descreva seu vínculo em até ${VINCULO_OUTRO_MAX} caracteres.`,
      };
}

export const CURSO_MAX = 120;

const LINKEDIN_RE = /^(?:[a-z]{2,3}\.|www\.)?linkedin\.com\/in\/([A-Za-z0-9_%-]{3,100})$/i;
const LATTES_RE = /^(?:www\.)?lattes\.cnpq\.br\/(\d{16})$/i;

/**
 * Perfil LinkedIn ou Lattes que vira QR no crachá (WML-69). Devolve o link canônico em https,
 * '' para campo vazio ou null se não for um perfil desses dois sites — o QR impresso nunca aponta
 * para outro domínio. Mesmas regras de public.normalizar_perfil() no banco. Obrigatório na
 * inscrição desde a WML-78: use validarPerfil() para a mensagem.
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

export const PERFIL_OBRIGATORIO_MSG =
  'Informe o link do seu perfil no LinkedIn ou no Lattes. Ele vira o QR Code do seu crachá.';
export const PERFIL_INVALIDO_MSG =
  'Use o link do seu perfil no LinkedIn (linkedin.com/in/…) ou no Lattes (lattes.cnpq.br/…).';

/**
 * Perfil da inscrição (obrigatório desde a WML-78) → mensagem de erro ou null.
 * Mesmas mensagens da Edge Function `register` (PERFIL_OBRIGATORIO / PERFIL_INVALIDO).
 */
export function validarPerfil(url: string): string | null {
  const perfil = normalizarPerfil(url);
  if (perfil === '') return PERFIL_OBRIGATORIO_MSG;
  return perfil === null ? PERFIL_INVALIDO_MSG : null;
}

/** `inicio`/`fim` em ISO com fuso (ex.: 2026-10-30T00:00:00-03:00). Limites inclusivos. */
export function dentroDaJanela(agora: Date, inicio: string, fim: string): boolean {
  const t = agora.getTime();
  return t >= new Date(inicio).getTime() && t <= new Date(fim).getTime();
}
