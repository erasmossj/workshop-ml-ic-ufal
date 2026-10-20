import { PDFDict, PDFDocument, PDFName, PDFString, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  formatarCargaHoraria,
  formatarCpf,
  gerarCertificado,
  posicaoX,
  tamanhoQueCabe,
  type Campos,
} from './certificado';

/** Modelo sintético: A4 deitado, 2 páginas (frente e verso). */
async function modelo(paginas = 2): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < paginas; i++) pdf.addPage([841.89, 595.28]);
  return pdf.save();
}

const campo = { pagina: 0, x: 120, y: 250, largura: 600, tamanho: 28 } as const;
const campos: Campos = {
  nome: { ...campo, alinhamento: 'centro', fonte: 'helvetica-negrito' },
  cpf: { ...campo, y: 300, tamanho: 14, alinhamento: 'centro', fonte: 'helvetica' },
  horas: { ...campo, y: 330, tamanho: 14, alinhamento: 'esquerda', fonte: 'times' },
};
const dados = {
  nome: 'Ana Sintética da Conceição',
  cpf: '52998224725',
  minutos: 830,
  codigo: 'K7QF3-M2D9A-0XB4C-TT8ZP',
  urlValidacao: 'https://exemplo.com/validar',
};

describe('formatação', () => {
  it.each([
    [1320, '22 horas'],
    [60, '1 hora'],
    [830, '13h50'],
    [65, '1h05'],
    [30, '0h30'],
  ])('%i minutos → %s', (min, texto) => {
    expect(formatarCargaHoraria(min)).toBe(texto);
  });

  it('CPF completo formatado (só dentro do PDF)', () => {
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
  });
});

describe('ajuste do texto na caixa', () => {
  it('mantém o tamanho quando cabe e reduz nomes longos até caber', async () => {
    const fonte = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    expect(tamanhoQueCabe(fonte, 'Ana', 28, 600)).toBe(28);
    const longo = 'Maria Aparecida dos Santos Albuquerque de Vasconcelos Cavalcanti Wanderley';
    const t = tamanhoQueCabe(fonte, longo, 28, 400);
    expect(t).toBeLessThan(28);
    expect(fonte.widthOfTextAtSize(longo, t)).toBeLessThanOrEqual(400);
  });

  it('nunca fica menor que 6 pt', async () => {
    const fonte = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica);
    expect(tamanhoQueCabe(fonte, 'x'.repeat(500), 28, 50)).toBe(6);
  });

  it('alinha à esquerda, ao centro e à direita dentro da caixa', () => {
    expect(posicaoX('esquerda', 100, 400, 50)).toBe(100);
    expect(posicaoX('centro', 100, 400, 50)).toBe(275);
    expect(posicaoX('direita', 100, 400, 50)).toBe(450);
  });
});

describe('certificado em PDF', () => {
  it('escreve sobre o modelo e mantém as páginas', async () => {
    const bytes = await gerarCertificado(await modelo(), campos, dados);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getTitle()).toBe('Certificado — IC-ML 2026');
    expect(pdf.getSubject()).toContain(dados.codigo);
  });

  it('não interpreta o nome: operadores de PDF no texto não quebram o arquivo', async () => {
    const bytes = await gerarCertificado(await modelo(1), campos, {
      ...dados,
      nome: 'Ana) Tj ET BT /F1 99 Tf (Hack',
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it('não quebra com nomes fora do Latin-1', async () => {
    const bytes = await gerarCertificado(await modelo(1), campos, {
      ...dados,
      nome: 'Łukasz Nguyễn 王',
    });
    expect(bytes.length).toBeGreaterThan(500);
  });

  it('campo em página que não existe no modelo é erro claro', async () => {
    await expect(
      gerarCertificado(await modelo(1), { ...campos, cpf: { ...campos.cpf, pagina: 3 } }, dados),
    ).rejects.toThrow('PAGINA_INEXISTENTE');
  });

  it('remove JavaScript e ações automáticas que viessem no modelo', async () => {
    const pdf = await PDFDocument.create();
    const pagina = pdf.addPage([841.89, 595.28]);
    const js = pdf.context.obj({ S: 'JavaScript', JS: PDFString.of('app.alert(1)') });
    pdf.catalog.set(PDFName.of('OpenAction'), js);
    pdf.catalog.set(PDFName.of('AA'), pdf.context.obj({ WC: js }));
    pdf.catalog.set(
      PDFName.of('Names'),
      pdf.context.obj({ JavaScript: pdf.context.obj({ Names: [PDFString.of('x'), js] }) }),
    );
    pagina.node.set(PDFName.of('AA'), pdf.context.obj({ O: js }));
    const bytes = await gerarCertificado(await pdf.save(), campos, dados);
    const saida = await PDFDocument.load(bytes);
    expect(saida.catalog.get(PDFName.of('OpenAction'))).toBeUndefined();
    expect(saida.catalog.get(PDFName.of('AA'))).toBeUndefined();
    const nomes = saida.catalog.lookupMaybe(PDFName.of('Names'), PDFDict);
    expect(nomes?.get(PDFName.of('JavaScript'))).toBeUndefined();
    expect(saida.getPage(0).node.get(PDFName.of('AA'))).toBeUndefined();
    expect(new TextDecoder('latin1').decode(bytes)).not.toContain('app.alert');
  });

  it('arquivo que não é PDF é erro claro', async () => {
    await expect(
      gerarCertificado(new TextEncoder().encode('não sou um pdf'), campos, dados),
    ).rejects.toThrow('MODELO_ILEGIVEL');
  });
});
