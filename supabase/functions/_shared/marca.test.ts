import { readFile } from 'node:fs/promises';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { carregarMarca, COR, rgbDe } from './marca';

// Os impressos usam o modo Light da coleção IC-ML / Color (Figma). A fonte única das cores é
// src/styles/global.css (.modo-claro); este teste acusa se as duas cópias divergirem.
async function tokensModoClaro(): Promise<Record<string, string>> {
  const css = await readFile(new URL('../../../src/styles/global.css', import.meta.url), 'utf8');
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
      ink100: t['ink-100'],
      ink200: t['ink-200'],
      ink300: t['ink-300'],
      lime500: t['lime-500'],
      limeInk: t['lime-ink'],
      lime900: t['lime-900'],
      onLime: t['on-lime'],
      blueInk: t['blue-ink'],
    });
  });

  it('converte hex em cor do PDF', () => {
    expect(rgbDe('#ffffff')).toEqual({ type: 'RGB', red: 1, green: 1, blue: 1 });
    expect(rgbDe('#0d1114').red).toBeCloseTo(13 / 255);
  });

  it('embute DM Sans, IBM Plex Mono e os logos', async () => {
    const pdf = await PDFDocument.create();
    const marca = await carregarMarca(pdf);
    expect(marca.personalizada).toBe(true);
    expect(marca.logoIcml?.width).toBeGreaterThan(0);
    expect(marca.logoConjunto?.width).toBeGreaterThan(0);
    pdf.addPage().drawText('Conceição', { font: marca.texto });
    const bytes = new TextDecoder('latin1').decode(await pdf.save({ useObjectStreams: false }));
    expect(bytes).toMatch(/DMSans/);
  });

  it('pode carregar só as fontes, sem embutir logos', async () => {
    const pdf = await PDFDocument.create();
    const marca = await carregarMarca(pdf, { logos: false });
    expect(marca.personalizada).toBe(true);
    expect(marca.logoIcml).toBeNull();
    expect(marca.logoConjunto).toBeNull();
  });

  it('cai para as fontes padrão do PDF quando os arquivos não existem', async () => {
    const pdf = await PDFDocument.create();
    const marca = await carregarMarca(pdf, { pasta: new URL('./nao-existe/', import.meta.url) });
    expect(marca.personalizada).toBe(false);
    expect(marca.logoIcml).toBeNull();
    expect(marca.texto.name).toBe('Helvetica');
  });
});
