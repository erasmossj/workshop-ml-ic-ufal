/**
 * Crachás 100×140 mm (WML-70), conforme o Figma "IC-ML" › Aplicações › Crachás. Só lógica, sem DOM.
 * O crachá não leva CPF nem e-mail; o QR (quando há) aponta só para LinkedIn ou Lattes.
 */
import { normalizarPerfil, normalizarVinculoOutro } from './validacao';

/** Grade de pontos do crachá do participante: 8 colunas × 4 linhas. */
export const PONTOS = 32;

const PARTICULAS = new Set(['da', 'das', 'de', 'di', 'do', 'dos', 'du', 'e', 'van', 'von']);
const ehParticula = (p: string | undefined) => !!p && PARTICULAS.has(p.toLowerCase());

/** Nome em duas linhas (Figma: "Ana Beatriz / Souza"); a última linha é o último sobrenome. */
export function linhasDoNome(nome: string): [string, string] {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length <= 1) return [partes[0] ?? '', ''];
  let linha2 = partes[partes.length - 1];
  let antes = partes.slice(0, -1);
  if (antes.length > 2) antes = ehParticula(antes[1]) ? [antes[0]] : antes.slice(0, 2);
  while (antes.length > 1 && ehParticula(antes[antes.length - 1])) {
    linha2 = `${antes.pop()} ${linha2}`;
  }
  return [antes.join(' '), linha2];
}

/**
 * Qual ponto da grade acende (0–31). Derivado do número da inscrição: o mesmo crachá sai igual
 * numa reimpressão, e inscrições seguidas acendem pontos diferentes (13 é primo com 32).
 */
export function pontoAceso(numero: string): number {
  const n = Number.parseInt(numero.replace(/\D/g, '') || '0', 10);
  return (n * 13) % PONTOS;
}

/**
 * Tag do crachá (WML-72): Estudante = Neutral, Docente = Blue, Outro = texto da pessoa em Neutral.
 * O texto do "Outro" volta cru — a página o coloca com textContent, nunca innerHTML.
 */
export function tagDoParticipante(
  vinculo: string | null,
  vinculoOutro: string | null,
): {
  texto: string;
  tom: 'tag-neutra' | 'tag-azul';
} {
  if (vinculo === 'docente') return { texto: 'Participante · Docente', tom: 'tag-azul' };
  if (vinculo === 'estudante') return { texto: 'Participante · Estudante', tom: 'tag-neutra' };
  const outro = vinculo === 'outro' ? normalizarVinculoOutro(vinculoOutro ?? '') : '';
  if (outro) return { texto: `Participante · ${outro}`, tom: 'tag-neutra' };
  return { texto: 'Participante', tom: 'tag-neutra' };
}

/** "Ciência da Computação · UFAL" (Figma), sem partes vazias. */
export function linhaCurso(curso: string | null, instituicao: string | null): string {
  return [curso, instituicao]
    .map((t) => (t ?? '').trim())
    .filter(Boolean)
    .join(' · ');
}

/** Etiqueta do crachá da organização (Figma: "id: 007"). */
export function idOrganizacao(i: number): string {
  return `id: ${String(i).padStart(3, '0')}`;
}

/** Link do QR: só perfil LinkedIn/Lattes válido; caso contrário, sem QR (espaço vazio). */
export function linkDoQr(perfil: string | null | undefined): string | null {
  const link = normalizarPerfil(perfil ?? '');
  return link ? link : null;
}
