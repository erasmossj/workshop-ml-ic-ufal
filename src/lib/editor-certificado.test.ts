import { describe, expect, it } from 'vitest';
import {
  camposPadrao,
  DADOS_FICTICIOS,
  limitar,
  moverPorTela,
  paraHorasEMinutos,
  paraMinutos,
} from './editor-certificado';

const A4_DEITADO = { largura: 841.89, altura: 595.28 };

describe('posições padrão', () => {
  it('três caixas centralizadas na 1ª página, dentro da página', () => {
    const c = camposPadrao(A4_DEITADO);
    for (const campo of [c.nome, c.cpf, c.horas]) {
      expect(campo.pagina).toBe(0);
      expect(campo.alinhamento).toBe('centro');
      expect(campo.x + campo.largura).toBeLessThanOrEqual(A4_DEITADO.largura);
      expect(campo.y).toBeLessThan(A4_DEITADO.altura);
    }
    expect(c.nome.tamanho).toBeGreaterThan(c.cpf.tamanho);
    expect(c.nome.y).toBeLessThan(c.cpf.y);
  });
});

describe('arrastar e limites', () => {
  const base = { ...camposPadrao(A4_DEITADO).nome, x: 100, y: 100, largura: 300 };

  it('converte o deslocamento da tela (px) para pontos do PDF pela escala', () => {
    const movido = moverPorTela(base, 50, 20, 0.5, A4_DEITADO);
    expect(movido.x).toBeCloseTo(base.x + 100);
    expect(movido.y).toBeCloseTo(base.y + 40);
  });

  it('não deixa a caixa sair da página', () => {
    const fora = limitar({ ...base, x: -50, y: 9999, largura: 5000 }, A4_DEITADO);
    expect(fora.x).toBe(0);
    expect(fora.largura).toBeLessThanOrEqual(A4_DEITADO.largura);
    expect(fora.y).toBeLessThanOrEqual(A4_DEITADO.altura - fora.tamanho);
  });

  it('arredonda para meio ponto (posição estável ao salvar)', () => {
    const c = limitar({ ...base, x: 10.26, y: 20.74 }, A4_DEITADO);
    expect(c.x).toBe(10.5);
    expect(c.y).toBe(20.5);
  });
});

describe('carga horária no formulário', () => {
  it.each([
    [220, [3, 40]],
    [180, [3, 0]],
    [0, [0, 0]],
  ])('%i min ↔ %j', (min, hm) => {
    expect(paraHorasEMinutos(min)).toEqual(hm);
    expect(paraMinutos(hm[0], hm[1])).toBe(min);
  });
  it('recusa valores fora do intervalo', () => {
    expect(paraMinutos(25, 0)).toBeNull();
    expect(paraMinutos(1, 60)).toBeNull();
    expect(paraMinutos(-1, 0)).toBeNull();
    expect(paraMinutos(Number.NaN, 0)).toBeNull();
  });
});

describe('prévia', () => {
  it('usa dados claramente fictícios e CPF sintético válido', () => {
    expect(DADOS_FICTICIOS.nome).toMatch(/exemplo/i);
    expect(DADOS_FICTICIOS.cpf).toMatch(/^\d{11}$/);
  });
});
