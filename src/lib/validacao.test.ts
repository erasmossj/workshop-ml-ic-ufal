import { describe, expect, it } from 'vitest';
import {
  PDF_MAX_BYTES,
  VINCULOS,
  dentroDaJanela,
  emailValido,
  nomeCompletoValido,
  normalizarEmail,
  normalizarPerfil,
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

describe('normalizarPerfil (LinkedIn ou Lattes para o QR do crachá)', () => {
  it('devolve o link canônico em https', () => {
    const casos: [string, string][] = [
      ['https://www.linkedin.com/in/ana-souza', 'https://www.linkedin.com/in/ana-souza'],
      ['linkedin.com/in/ana-souza/', 'https://www.linkedin.com/in/ana-souza'],
      ['http://br.linkedin.com/in/ana_souza-01?utm=x', 'https://www.linkedin.com/in/ana_souza-01'],
      ['  HTTPS://WWW.LINKEDIN.COM/in/AnaSouza  ', 'https://www.linkedin.com/in/AnaSouza'],
      ['http://lattes.cnpq.br/1234567890123456', 'https://lattes.cnpq.br/1234567890123456'],
      ['lattes.cnpq.br/1234567890123456/', 'https://lattes.cnpq.br/1234567890123456'],
    ];
    for (const [entrada, saida] of casos) expect(normalizarPerfil(entrada), entrada).toBe(saida);
  });

  it('vazio é permitido (campo opcional)', () => {
    expect(normalizarPerfil('')).toBe('');
    expect(normalizarPerfil('   ')).toBe('');
  });

  it('recusa outros domínios e formatos (o link vira QR impresso)', () => {
    for (const url of [
      'https://evil.com/linkedin.com/in/ana',
      'https://linkedin.com.evil.com/in/ana',
      'https://www.linkedin.com/company/ic-ufal',
      'https://www.linkedin.com/in/a',
      'javascript:alert(1)',
      'https://lattes.cnpq.br/123',
      'https://lattes.cnpq.br/1234567890123456/../x',
      'ftp://lattes.cnpq.br/1234567890123456',
      'ana-souza',
    ]) {
      expect(normalizarPerfil(url), url).toBeNull();
    }
  });
});

describe('VINCULOS', () => {
  it('são as opções do Choice do Figma', () => {
    expect(VINCULOS.map((v) => v.valor)).toEqual(['graduacao', 'mestrado', 'outro']);
  });
});
