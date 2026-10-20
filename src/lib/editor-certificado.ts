/**
 * Lógica do editor do modelo de certificado (WML-57/58 · ADR-002), sem DOM para ser testada.
 * Posições em pontos do PDF, origem no canto superior esquerdo (mesmo formato do servidor).
 */
import type { Campo, Campos } from '../../supabase/functions/_shared/certificado';

export type Dimensoes = { largura: number; altura: number };

/** Prévia: nome claramente fictício e CPF sintético válido (nunca dados reais). */
export const DADOS_FICTICIOS = {
  nome: 'Maria Exemplo de Oliveira Santos',
  cpf: '52998224725',
  minutos: 1320,
  codigo: 'EXEMP-L0000-00000-00000',
};

export function camposPadrao(p: Dimensoes): Campos {
  const base = {
    pagina: 0,
    x: p.largura * 0.1,
    largura: p.largura * 0.8,
    alinhamento: 'centro' as const,
  };
  return {
    nome: limitar({ ...base, y: p.altura * 0.42, tamanho: 28, fonte: 'helvetica-negrito' }, p),
    cpf: limitar({ ...base, y: p.altura * 0.52, tamanho: 14, fonte: 'helvetica' }, p),
    horas: limitar({ ...base, y: p.altura * 0.58, tamanho: 14, fonte: 'helvetica' }, p),
  };
}

const meioPonto = (n: number) => Math.round(n * 2) / 2;

/** Mantém a caixa dentro da página e arredonda para meio ponto. */
export function limitar(c: Campo, p: Dimensoes): Campo {
  const tamanho = Math.min(72, Math.max(6, c.tamanho));
  // Para baixo: arredondar para cima poderia passar da borda da página.
  const largura = Math.floor(Math.min(p.largura, Math.max(10, c.largura)) * 2) / 2;
  const x = Math.min(meioPonto(Math.max(0, c.x)), Math.floor((p.largura - largura) * 2) / 2);
  const y = Math.min(meioPonto(Math.max(0, c.y)), Math.floor((p.altura - tamanho) * 2) / 2);
  return { ...c, tamanho, largura, x, y };
}

/** Arrastar na tela: deslocamento em px dividido pela escala (px por ponto). */
export function moverPorTela(c: Campo, dxPx: number, dyPx: number, escala: number, p: Dimensoes) {
  return limitar({ ...c, x: c.x + dxPx / escala, y: c.y + dyPx / escala }, p);
}

export function paraHorasEMinutos(minutos: number): [number, number] {
  return [Math.floor(minutos / 60), minutos % 60];
}

/** Horas (0–24) e minutos (0–59) → minutos; null se inválido. */
export function paraMinutos(horas: number, minutos: number): number | null {
  if (!Number.isInteger(horas) || !Number.isInteger(minutos)) return null;
  if (horas < 0 || minutos < 0 || minutos > 59) return null;
  const total = horas * 60 + minutos;
  return total <= 1440 ? total : null;
}
