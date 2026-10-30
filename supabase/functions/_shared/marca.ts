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
  lime900: '#eefac8',
  onLime: '#0a0d06',
  blueInk: '#1f4fd6',
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
  logoIcml: PDFImage | null;
  logoConjunto: PDFImage | null;
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
 * Embute fontes (e, se pedido, os logos) no PDF. Se faltar algum arquivo, o PDF sai com
 * Helvetica/Courier e sem logos — o documento nunca deixa de ser gerado por causa da marca.
 */
export async function carregarMarca(
  pdf: PDFDocument,
  opcoes: { logos?: boolean; pasta?: URL } = {},
): Promise<Marca> {
  const { logos = true, pasta = PASTA } = opcoes;
  try {
    const fontes = await Promise.all(
      [
        'DMSans-Regular.ttf',
        'DMSans-Bold.ttf',
        'IBMPlexMono-Regular.ttf',
        'IBMPlexMono-Medium.ttf',
      ].map((nome) => ler(new URL(nome, pasta))),
    );
    const imagens = logos
      ? await Promise.all(
          ['logo-icml-claro.png', 'logo-conjunto-preto.png'].map((nome) =>
            ler(new URL(nome, pasta)),
          ),
        )
      : [];
    pdf.registerFontkit(fontkit);
    const [texto, textoForte, mono, monoMedio] = await Promise.all(
      fontes.map((bytes) => pdf.embedFont(bytes, { subset: true })),
    );
    return {
      texto,
      textoForte,
      mono,
      monoMedio,
      logoIcml: logos ? await pdf.embedPng(imagens[0]) : null,
      logoConjunto: logos ? await pdf.embedPng(imagens[1]) : null,
      personalizada: true,
    };
  } catch {
    return {
      texto: await pdf.embedFont(StandardFonts.Helvetica),
      textoForte: await pdf.embedFont(StandardFonts.HelveticaBold),
      mono: await pdf.embedFont(StandardFonts.Courier),
      monoMedio: await pdf.embedFont(StandardFonts.CourierBold),
      logoIcml: null,
      logoConjunto: null,
      personalizada: false,
    };
  }
}
