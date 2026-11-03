import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { carregarMarca, COR, FONTE_EMAIL, RAIO, rgbDe } from './marca';

// Os impressos usam o modo Light da coleção IC-ML / Color (Figma). A fonte única das cores é
// src/styles/global.css (.modo-claro); este teste acusa se as duas cópias divergirem.
const lerCss = () => readFile(new URL('../../../src/styles/global.css', import.meta.url), 'utf8');

async function tokensModoClaro(): Promise<Record<string, string>> {
  const css = await lerCss();
  const trecho = (seletor: string) => {
    const inicio = css.indexOf(`${seletor} {`);
    return css.slice(inicio, css.indexOf('}', inicio));
  };
  const ler = (bloco: string) =>
    Object.fromEntries(
      [...bloco.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [
        m[1],
        m[2].toLowerCase(),
      ]),
    );
  return { ...ler(trecho(':root')), ...ler(trecho('.modo-claro')) };
}

describe('marca dos impressos (modo Light)', () => {
  it('usa exatamente as cores do modo claro do site', async () => {
    const t = await tokensModoClaro();
    expect(COR).toEqual({
      bg000: t['bg-000'],
      bg100: t['bg-100'],
      bg200: t['bg-200'],
      bg300: t['bg-300'],
      line100: t['line-100'],
      line200: t['line-200'],
      lineDot: t['line-dot'],
      ink100: t['ink-100'],
      ink200: t['ink-200'],
      ink300: t['ink-300'],
      lime500: t['lime-500'],
      limeInk: t['lime-ink'],
      lime900: t['lime-900'],
      onLime: t['on-lime'],
      blueInk: t['blue-ink'],
      blue900: t['blue-900'],
    });
  });

  it('usa os raios do Figma definidos no site', async () => {
    const css = await lerCss();
    const raio = (nome: string) =>
      Number(css.match(new RegExp(String.raw`--radius-${nome}:\s*(\d+)px`))?.[1]);
    expect(RAIO).toEqual({ r1: raio('1'), r2: raio('2'), r3: raio('3'), pill: raio('pill') });
  });

  it('e-mail pede as fontes da marca e cai para fontes do sistema da mesma família', () => {
    expect(FONTE_EMAIL.texto).toMatch(/^'DM Sans',.*sans-serif$/);
    expect(FONTE_EMAIL.mono).toMatch(/^'IBM Plex Mono',.*monospace$/);
    expect(FONTE_EMAIL.display).toMatch(/^'Pixelify Sans',.*monospace$/);
    expect(FONTE_EMAIL.numeral).toMatch(/^'Doto',.*monospace$/);
  });

  it('converte hex em cor do PDF', () => {
    expect(rgbDe('#ffffff')).toEqual({ type: 'RGB', red: 1, green: 1, blue: 1 });
    expect(rgbDe('#0d1114').red).toBeCloseTo(13 / 255);
  });

  it('embute DM Sans, IBM Plex Mono, Pixelify Sans, Doto, os logos e a faixa halftone', async () => {
    const pdf = await PDFDocument.create();
    const marca = await carregarMarca(pdf, { faixa: true });
    expect(marca.personalizada).toBe(true);
    expect(marca.logoIcml?.width).toBeGreaterThan(0);
    expect(marca.logoConjunto?.width).toBeGreaterThan(0);
    // Recorte da faixa do Cartaz A5 (559 × 129,4 no Figma): mesma proporção.
    expect(marca.faixa!.width / marca.faixa!.height).toBeCloseTo(559 / 129.421, 1);
    const pagina = pdf.addPage();
    pagina.drawText('Conceição', { font: marca.texto });
    pagina.drawText('Inscrição', { font: marca.display });
    pagina.drawText('02—04', { font: marca.numeral });
    const bytes = new TextDecoder('latin1').decode(await pdf.save({ useObjectStreams: false }));
    expect(bytes).toMatch(/DMSans/);
    expect(bytes).toMatch(/PixelifySans/);
    expect(bytes).toMatch(/Doto/);
  });

  it('pode carregar só as fontes, sem embutir logos', async () => {
    const pdf = await PDFDocument.create();
    const marca = await carregarMarca(pdf, { logos: false });
    expect(marca.personalizada).toBe(true);
    expect(marca.logoIcml).toBeNull();
    expect(marca.logoConjunto).toBeNull();
    expect(marca.faixa).toBeNull();
  });

  it('só embute a faixa halftone quando pedida (imagem embutida pesa mesmo sem uso)', async () => {
    const pdf = await PDFDocument.create();
    const marca = await carregarMarca(pdf);
    expect(marca.logoConjunto).not.toBeNull();
    expect(marca.faixa).toBeNull();
  });

  it('cai para as fontes padrão do PDF quando os arquivos não existem', async () => {
    const pdf = await PDFDocument.create();
    const marca = await carregarMarca(pdf, { pasta: new URL('./nao-existe/', import.meta.url) });
    expect(marca.personalizada).toBe(false);
    expect(marca.logoIcml).toBeNull();
    expect(marca.texto.name).toBe('Helvetica');
  });
});
