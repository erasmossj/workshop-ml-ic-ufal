import { describe, expect, it } from 'vitest';
import { criarVerificadorDeOrigem } from './origens';

const PREVIEW = 'https://workshop-ml-ic-ufal-*-erasmo-junior.vercel.app';

describe('criarVerificadorDeOrigem', () => {
  it('aceita origens exatas da lista', () => {
    const permitida = criarVerificadorDeOrigem(
      'https://workshop-ml-ic-ufal.vercel.app, http://localhost:4321',
    );
    expect(permitida('https://workshop-ml-ic-ufal.vercel.app')).toBe(true);
    expect(permitida('http://localhost:4321')).toBe(true);
  });

  it('recusa origens fora da lista, vazias ou só parecidas', () => {
    const permitida = criarVerificadorDeOrigem('https://workshop-ml-ic-ufal.vercel.app');
    expect(permitida('')).toBe(false);
    expect(permitida('null')).toBe(false);
    expect(permitida('http://workshop-ml-ic-ufal.vercel.app')).toBe(false);
    expect(permitida('https://workshop-ml-ic-ufal.vercel.app.evil.com')).toBe(false);
    expect(permitida('https://xworkshop-ml-ic-ufal.vercel.app')).toBe(false);
  });

  it('lista vazia não libera nada', () => {
    expect(criarVerificadorDeOrigem('')('https://workshop-ml-ic-ufal.vercel.app')).toBe(false);
  });

  it('curinga aceita as URLs de preview da Vercel (por hash e por branch)', () => {
    const permitida = criarVerificadorDeOrigem(PREVIEW);
    expect(permitida('https://workshop-ml-ic-ufal-a1b2c3d4e-erasmo-junior.vercel.app')).toBe(true);
    expect(
      permitida('https://workshop-ml-ic-ufal-git-feat-wml-29-email-erasmo-junior.vercel.app'),
    ).toBe(true);
  });

  it('curinga não atravessa pontos nem casa com o vazio', () => {
    const permitida = criarVerificadorDeOrigem(PREVIEW);
    expect(permitida('https://workshop-ml-ic-ufal--erasmo-junior.vercel.app')).toBe(false);
    expect(permitida('https://workshop-ml-ic-ufal-x.evil.com-erasmo-junior.vercel.app')).toBe(
      false,
    );
    expect(permitida('https://workshop-ml-ic-ufal-a1b2-erasmo-junior.vercel.app.evil.com')).toBe(
      false,
    );
    expect(permitida('http://workshop-ml-ic-ufal-a1b2-erasmo-junior.vercel.app')).toBe(false);
  });

  it('o resto do padrão é literal (o ponto não vira "qualquer caractere")', () => {
    const permitida = criarVerificadorDeOrigem(PREVIEW);
    expect(permitida('https://workshop-ml-ic-ufal-a1b2-erasmo-juniorXvercel.app')).toBe(false);
  });

  it('ignora curinga amplo demais (rótulo inteiro), que liberaria qualquer site da Vercel', () => {
    const permitida = criarVerificadorDeOrigem('https://*.vercel.app, *, https://*');
    expect(permitida('https://qualquer-coisa.vercel.app')).toBe(false);
    expect(permitida('https://evil.com')).toBe(false);
  });
});
