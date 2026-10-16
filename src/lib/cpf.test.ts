import { describe, expect, it } from 'vitest';
import { cpfValido, formatarCpf, mascararCpf, somenteDigitos } from './cpf';

// CPFs sintéticos válidos (gerados para teste) — nunca use CPFs reais aqui.
const VALIDO = '529.982.247-25';
const VALIDO_2 = '11144477735';

describe('somenteDigitos', () => {
  it('remove pontuação e espaços', () => {
    expect(somenteDigitos(' 529.982.247-25 ')).toBe('52998224725');
  });
});

describe('cpfValido', () => {
  it('aceita CPFs com dígitos verificadores corretos, com ou sem máscara', () => {
    expect(cpfValido(VALIDO)).toBe(true);
    expect(cpfValido(VALIDO_2)).toBe(true);
  });

  it('rejeita dígito verificador errado', () => {
    expect(cpfValido('529.982.247-24')).toBe(false);
    expect(cpfValido('111.444.777-36')).toBe(false);
  });

  it('rejeita sequências repetidas, tamanhos errados e vazio', () => {
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cpfValido('000.000.000-00')).toBe(false);
    expect(cpfValido('5299822472')).toBe(false);
    expect(cpfValido('529982247250')).toBe(false);
    expect(cpfValido('')).toBe(false);
  });
});

describe('formatarCpf', () => {
  it('formata progressivamente enquanto o usuário digita', () => {
    expect(formatarCpf('529')).toBe('529');
    expect(formatarCpf('5299')).toBe('529.9');
    expect(formatarCpf('5299822')).toBe('529.982.2');
    expect(formatarCpf('52998224725')).toBe('529.982.247-25');
  });

  it('ignora dígitos além do 11º', () => {
    expect(formatarCpf('5299822472599')).toBe('529.982.247-25');
  });
});

describe('mascararCpf', () => {
  it('mostra apenas os 6 dígitos centrais (padrão LGPD do gov.br)', () => {
    expect(mascararCpf(VALIDO)).toBe('***.982.247-**');
  });

  it('não vaza nada quando o CPF está incompleto', () => {
    expect(mascararCpf('529.98')).toBe('***.***.***-**');
  });
});
