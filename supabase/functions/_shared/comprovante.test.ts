import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { gerarComprovante, paraWinAnsi } from './comprovante';

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

  it('não quebra com nomes fora do Latin-1 (fonte padrão do PDF)', async () => {
    const bytes = await gerarComprovante({ ...dados, nome: 'Łukasz Nguyễn 王 Ñandú' });
    expect(bytes.length).toBeGreaterThan(1000);
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
