import { describe, expect, it } from 'vitest';
import {
  PDF_MAX_BYTES,
  dentroDaJanela,
  emailValido,
  nomeCompletoValido,
  normalizarEmail,
  validarPdf,
} from './validacao';

const PDF_MAGICO = new TextEncoder().encode('%PDF-1.7\n');

describe('emailValido / normalizarEmail', () => {
  it('aceita e-mails comuns e normaliza caixa e espaços', () => {
    expect(emailValido('aluna@ic.ufal.br')).toBe(true);
    expect(normalizarEmail('  Aluna@IC.ufal.br ')).toBe('aluna@ic.ufal.br');
  });

  it('rejeita formatos inválidos', () => {
    for (const e of ['', 'sem-arroba', 'a@b', 'a @b.com', 'a@b..com']) {
      expect(emailValido(e), e).toBe(false);
    }
  });
});

describe('nomeCompletoValido', () => {
  it('exige nome e sobrenome, aceitando acentos, hífen e apóstrofo', () => {
    expect(nomeCompletoValido('Maria da Conceição')).toBe(true);
    expect(nomeCompletoValido("João D'Ávila")).toBe(true);
    expect(nomeCompletoValido('Ana Lúcia Santos-Silva')).toBe(true);
  });

  it('rejeita nome único, números e vazio', () => {
    expect(nomeCompletoValido('Maria')).toBe(false);
    expect(nomeCompletoValido('Maria 2')).toBe(false);
    expect(nomeCompletoValido('   ')).toBe(false);
  });
});

describe('validarPdf', () => {
  const arquivo = (o: Partial<{ name: string; size: number; type: string }> = {}) => ({
    name: 'trabalho.pdf',
    size: 1024,
    type: 'application/pdf',
    ...o,
  });

  it('aceita PDF real dentro do limite', () => {
    expect(validarPdf(arquivo(), PDF_MAGICO)).toBeNull();
  });

  it('rejeita arquivo acima de 5 MB', () => {
    expect(validarPdf(arquivo({ size: PDF_MAX_BYTES + 1 }), PDF_MAGICO)).toMatch(/5 MB/);
  });

  it('rejeita arquivo que não é PDF pela extensão/tipo', () => {
    expect(validarPdf(arquivo({ name: 'a.docx', type: 'application/msword' }), PDF_MAGICO)).toMatch(
      /PDF/,
    );
  });

  it('rejeita arquivo renomeado para .pdf sem a assinatura %PDF', () => {
    const falso = new TextEncoder().encode('PK\u0003\u0004');
    expect(validarPdf(arquivo(), falso)).toMatch(/PDF/);
  });
});

describe('dentroDaJanela', () => {
  const ini = '2026-10-30T00:00:00-03:00';
  const fim = '2026-11-16T23:59:59-03:00';

  it('considera o horário de Maceió nos limites', () => {
    expect(dentroDaJanela(new Date('2026-10-30T03:00:00Z'), ini, fim)).toBe(true);
    expect(dentroDaJanela(new Date('2026-10-30T02:59:59Z'), ini, fim)).toBe(false);
    expect(dentroDaJanela(new Date('2026-11-17T02:59:59Z'), ini, fim)).toBe(true);
    expect(dentroDaJanela(new Date('2026-11-17T03:00:00Z'), ini, fim)).toBe(false);
  });
});
