// Identidade visual (Figma "IC-ML", WML-68) dos impressos gerados nas Edge Functions: comprovante,
// certificado e e-mails. Modo Light da coleção IC-ML / Color — os mesmos valores de .modo-claro em
// src/styles/global.css (marca.test.ts confere). Fontes OFL e logos ficam em ./marca/ e sobem com
// a função via `static_files` (supabase/config.toml).
import fontkit from '@pdf-lib/fontkit';
import {
  rgb,
  StandardFonts,
  type PDFDocument,
  type PDFFont,
  type PDFImage,
  type RGB,
} from 'pdf-lib';

export const COR = {
  bg000: '#f4f3ee',
  bg100: '#ecebe5',
  bg200: '#ffffff',
  bg300: '#e3e2db',
  line100: '#d6d5cd',
  line200: '#77766e',
  ink100: '#0d1114',
  ink200: '#3c464c',
  ink300: '#5b656b',
  lime500: '#c8ff2e',
  limeInk: '#4a6600',
  lineDot: '#d3d2ca',
  lime900: '#eefac8',
  onLime: '#0a0d06',
  blueInk: '#1f4fd6',
  blue900: '#e3eaff',
} as const;

/** Raios do Figma (radius-1/2/3/pill), em px no e-mail e em pt no PDF. */
export const RAIO = { r1: 2, r2: 6, r3: 16, pill: 999 } as const;

/**
 * Pilhas de fonte do e-mail. Cliente de e-mail não baixa fonte do site: vale a fonte instalada ou
 * o fallback (mesma família visual — sans para texto, mono para rótulos, display e numerais).
 */
export const FONTE_EMAIL = {
  texto: "'DM Sans',Arial,Helvetica,sans-serif",
  mono: "'IBM Plex Mono','Courier New',Courier,monospace",
  display: "'Pixelify Sans','IBM Plex Mono','Courier New',Courier,monospace",
  numeral: "'Doto','IBM Plex Mono','Courier New',Courier,monospace",
} as const;

export function rgbDe(hex: string): RGB {
  const n = Number.parseInt(hex.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export type Marca = {
  /** DM Sans (texto). */
  texto: PDFFont;
  /** DM Sans Bold (títulos e destaques). */
  textoForte: PDFFont;
  /** IBM Plex Mono (dados). */
  mono: PDFFont;
  /** IBM Plex Mono Medium (rótulos de sistema). */
  monoMedio: PDFFont;
  /** Pixelify Sans SemiBold (display). */
  display: PDFFont;
  /** Doto ExtraBold (numerais). */
  numeral: PDFFont;
  logoIcml: PDFImage | null;
  logoConjunto: PDFImage | null;
  /** Textura/Ribbon do modo Light, recortada como a faixa halftone do Cartaz A5 (PNG transparente). */
  faixa: PDFImage | null;
  /** false = arquivos indisponíveis; usa as fontes padrão do PDF e nenhum logo. */
  personalizada: boolean;
};

const PASTA = new URL('./marca/', import.meta.url);

async function ler(arquivo: URL): Promise<Uint8Array> {
  const deno = (globalThis as { Deno?: { readFile(u: URL): Promise<Uint8Array> } }).Deno;
  if (deno) return await deno.readFile(arquivo);
  const { readFile } = await import('node:fs/promises');
  return new Uint8Array(await readFile(arquivo));
}

/**
 * Embute fontes (e, se pedido, os logos e a faixa halftone) no PDF. Se faltar algum arquivo, o PDF
 * sai com Helvetica/Courier e sem imagens — o documento nunca deixa de ser gerado por causa da marca.
 * A faixa (~90 KB) só entra com `faixa: true`: imagem embutida vai para o arquivo mesmo sem uso.
 */
export async function carregarMarca(
  pdf: PDFDocument,
  opcoes: { logos?: boolean; faixa?: boolean; pasta?: URL } = {},
): Promise<Marca> {
  const { logos = true, pasta = PASTA } = opcoes;
  const comFaixa = logos && opcoes.faixa === true;
  try {
    const fontes = await Promise.all(
      [
        'DMSans-Regular.ttf',
        'DMSans-Bold.ttf',
        'IBMPlexMono-Regular.ttf',
        'IBMPlexMono-Medium.ttf',
        'PixelifySans-SemiBold.ttf',
        'Doto-ExtraBold.ttf',
      ].map((nome) => ler(new URL(nome, pasta))),
    );
    const imagens = logos
      ? await Promise.all(
          [
            'logo-icml-claro.png',
            'logo-conjunto-preto.png',
            ...(comFaixa ? ['textura-faixa-claro.png'] : []),
          ].map((nome) => ler(new URL(nome, pasta))),
        )
      : [];
    pdf.registerFontkit(fontkit);
    const [texto, textoForte, mono, monoMedio, display, numeral] = await Promise.all(
      // Sem ligaduras: o "fi" da Pixelify desenha outro glifo e ligaduras atrapalham copiar/buscar.
      fontes.map((bytes) => pdf.embedFont(bytes, { subset: true, features: { liga: false } })),
    );
    return {
      texto,
      textoForte,
      mono,
      monoMedio,
      display,
      numeral,
      logoIcml: logos ? await pdf.embedPng(imagens[0]) : null,
      logoConjunto: logos ? await pdf.embedPng(imagens[1]) : null,
      faixa: comFaixa ? await pdf.embedPng(imagens[2]) : null,
      personalizada: true,
    };
  } catch {
    return {
      texto: await pdf.embedFont(StandardFonts.Helvetica),
      textoForte: await pdf.embedFont(StandardFonts.HelveticaBold),
      mono: await pdf.embedFont(StandardFonts.Courier),
      monoMedio: await pdf.embedFont(StandardFonts.CourierBold),
      display: await pdf.embedFont(StandardFonts.HelveticaBold),
      numeral: await pdf.embedFont(StandardFonts.CourierBold),
      logoIcml: null,
      logoConjunto: null,
      faixa: null,
      personalizada: false,
    };
  }
}
