import {
  decodePDFRawStream,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFName,
  PDFNumber,
  PDFRawStream,
  type PDFRef,
} from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { datasEmDestaque, gerarComprovante, paraWinAnsi } from './comprovante';

const MM = 72 / 25.4;

/** Imagens desenhadas na página: tamanho original (px) e tamanho desenhado (pt). */
async function imagensDesenhadas(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const pagina = pdf.getPage(0);
  const conteudo = pagina.node.Contents()!;
  const fluxos =
    conteudo instanceof PDFArray
      ? conteudo.asArray().map((r) => pdf.context.lookup(r as PDFRef))
      : [conteudo];
  const operadores = fluxos
    .map((f) => new TextDecoder('latin1').decode(decodePDFRawStream(f as PDFRawStream).decode()))
    .join('\n');
  const xobjetos = pagina.node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
  return [...operadores.matchAll(/([\d.]+) 0 0 ([\d.]+) 0 0 cm\n1 0 0 1 0 0 cm\n\/(\S+) Do/g)].map(
    ([, largura, altura, nome]) => {
      const imagem = pdf.context.lookup(xobjetos.get(PDFName.of(nome)), PDFRawStream);
      const px = (k: string) => (imagem.dict.get(PDFName.of(k)) as PDFNumber).asNumber();
      return { px: [px('Width'), px('Height')], pt: [Number(largura), Number(altura)] };
    },
  );
}

async function fontesEmbutidas(bytes: Uint8Array): Promise<string[]> {
  const pdf = await PDFDocument.load(bytes);
  return pdf.context
    .enumerateIndirectObjects()
    .map(([, o]) => o)
    .filter(
      (o): o is PDFDict => o instanceof PDFDict && o.get(PDFName.of('Type')) === PDFName.of('Font'),
    )
    .map((o) => o.get(PDFName.of('BaseFont'))?.toString() ?? '');
}

const dados = {
  numero: 'ICML26-0042',
  nome: 'Participante Sintética da Silva',
  cpfMascarado: '***.982.247-**',
  email: 'participante@exemplo.com',
  minicurso: 'Minicurso de Machine Learning na prática',
  trabalho:
    'Classificação de imagens com CNNs em dispositivos de baixo custo para agricultura familiar',
  qr: 'ICML26-0042.AAAAAAAAAAAAAAAAAAAAAA',
  emitidoEm: new Date('2026-10-30T13:05:00Z'),
};

describe('comprovante de inscrição (PDF)', () => {
  it('gera um PDF de uma página com título e assunto identificando a inscrição', async () => {
    const bytes = await gerarComprovante(dados);
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(1);
    expect(pdf.getTitle()).toBe('Comprovante de inscrição — ICML26-0042');
    expect(pdf.getAuthor()).toBe('IC-ML 2026');
  });

  it('funciona sem minicurso e sem trabalho', async () => {
    const bytes = await gerarComprovante({ ...dados, minicurso: null, trabalho: null });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it('usa as quatro fontes da identidade (DM Sans, IBM Plex Mono, Pixelify Sans, Doto)', async () => {
    const fontes = (await fontesEmbutidas(await gerarComprovante(dados))).join(' ');
    for (const nome of ['DMSans', 'IBMPlexMono', 'PixelifySans', 'Doto']) {
      expect(fontes).toContain(nome);
    }
  });

  it('traz o logo conjunto IEEE × CS × IC com pelo menos 8 mm de altura', async () => {
    const imagens = await imagensDesenhadas(await gerarComprovante(dados));
    const conjunto = imagens.find((i) => i.px[0] === 1264 && i.px[1] === 230);
    expect(conjunto).toBeDefined();
    expect(conjunto!.pt[1]).toBeGreaterThanOrEqual(8 * MM);
    // Proporção preservada (sem distorcer o logo).
    expect(conjunto!.pt[0] / conjunto!.pt[1]).toBeCloseTo(1264 / 230, 2);
  });

  it('traz o logo IC-ML (lockup ≥ 24 px) e a faixa halftone na largura da página', async () => {
    const imagens = await imagensDesenhadas(await gerarComprovante(dados));
    const icml = imagens.find((i) => i.px[0] === 742);
    expect(icml!.pt[1]).toBeGreaterThanOrEqual(18); // 24 px de tela ≈ 18 pt
    expect(icml!.pt[0] / icml!.pt[1]).toBeCloseTo(742 / 144, 2);
    const faixa = imagens.find((i) => i.px[0] === 1190);
    expect(faixa!.pt[0]).toBeCloseTo(595.28, 1);
  });

  it('mantém uma página e tamanho razoável com nome, e-mail e título no limite do banco', async () => {
    const bytes = await gerarComprovante({
      ...dados,
      nome: 'Nome Sintético Comprido '.repeat(6).slice(0, 120).trim(),
      email: `${'a'.repeat(242)}@exemplo.com`,
      minicurso: 'Machine Learning na prática com Google Colab: do pré-processamento à avaliação',
      trabalho: 'Título sintético de trabalho com muitas palavras '.repeat(6).slice(0, 250),
    });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    expect(bytes.length).toBeLessThan(250_000);
  });

  it('não grava o CPF completo nem dados pessoais nos metadados', async () => {
    const pdf = await PDFDocument.load(await gerarComprovante(dados));
    const meta = [pdf.getTitle(), pdf.getSubject(), pdf.getAuthor(), pdf.getKeywords()].join(' ');
    expect(meta).not.toContain(dados.nome);
    expect(meta).not.toContain(dados.email);
    expect(meta).not.toMatch(/\d{3}\.\d{3}/);
  });

  it('não quebra com nomes fora do Latin-1 (fonte padrão do PDF)', async () => {
    const bytes = await gerarComprovante({ ...dados, nome: 'Łukasz Nguyễn 王 Ñandú' });
    expect(bytes.length).toBeGreaterThan(1000);
  });
});

describe('datasEmDestaque', () => {
  it('resume os dias do evento como no cartaz, no fuso de Maceió', () => {
    expect(datasEmDestaque()).toEqual({ dias: '02—04', mesAno: 'DEZ · 2026' });
  });
});

describe('paraWinAnsi', () => {
  const latin1 = new Set(
    [...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZáãçéêíóôõúÁÃÇÉ —·*.-'].map((c) =>
      c.codePointAt(0)!,
    ),
  );
  it('mantém acentos do português e troca o resto por equivalente sem acento ou "?"', () => {
    expect(paraWinAnsi('Conceição', latin1)).toBe('Conceição');
    expect(paraWinAnsi('Łukasz', latin1)).toBe('?ukasz');
    expect(paraWinAnsi('Nguyễn', latin1)).toBe('Nguyen');
    expect(paraWinAnsi('王', latin1)).toBe('?');
  });
});
