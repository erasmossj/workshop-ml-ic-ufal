import { describe, expect, it } from 'vitest';
import { formatarCargaHoraria, formatarEmissao, normalizarCodigo } from './certificado';

describe('código de validação digitado pela pessoa', () => {
  it('aceita minúsculas, espaços e sem hífens', () => {
    expect(normalizarCodigo(' k7qf3 m2d9a 0xb4c tt8zp ')).toBe('K7QF3-M2D9A-0XB4C-TT8ZP');
  });
  it('troca letras parecidas com números (O→0, I/L→1), como no servidor', () => {
    expect(normalizarCodigo('K7QF3-M2D9A-OXB4C-TT8ZP')).toBe('K7QF3-M2D9A-0XB4C-TT8ZP');
    expect(normalizarCodigo('L7QF3-M2D9A-0XB4C-TT8ZI')).toBe('17QF3-M2D9A-0XB4C-TT8Z1');
  });
  it.each(['', 'ABC', 'K7QF3-M2D9A-0XB4C', 'x'.repeat(40)])('recusa %j', (t) => {
    expect(normalizarCodigo(t)).toBeNull();
  });
});

describe('formatação para a tela', () => {
  it('data de emissão no fuso de Maceió', () => {
    expect(formatarEmissao('2026-12-05T01:30:00Z')).toBe('04/12/2026');
  });
  it('carga horária', () => {
    expect(formatarCargaHoraria(1320)).toBe('22 horas');
  });
});
