import { describe, expect, it } from 'vitest';
import {
  PONTOS,
  idOrganizacao,
  linhaCurso,
  linhasDoNome,
  linkDoQr,
  pontoAceso,
  tagDoParticipante,
} from './cracha';

describe('linhasDoNome (nome em duas linhas, como no Figma)', () => {
  it('última palavra embaixo', () => {
    expect(linhasDoNome('Ana Beatriz Souza')).toEqual(['Ana Beatriz', 'Souza']);
    expect(linhasDoNome('Gabriel Jatobá')).toEqual(['Gabriel', 'Jatobá']);
  });

  it('nomes longos ficam com os dois primeiros e o último', () => {
    expect(linhasDoNome('Participante Sintética da Silva')).toEqual([
      'Participante Sintética',
      'Silva',
    ]);
    expect(linhasDoNome('Maria da Conceição Santos Lima')).toEqual(['Maria', 'Lima']);
  });

  it('partícula (da, de, dos…) vai junto com o sobrenome', () => {
    expect(linhasDoNome('Maria da Silva')).toEqual(['Maria', 'da Silva']);
    expect(linhasDoNome('João dos Santos')).toEqual(['João', 'dos Santos']);
  });

  it('nome único e espaços extras', () => {
    expect(linhasDoNome('  Ana  ')).toEqual(['Ana', '']);
    expect(linhasDoNome('Ana   Souza')).toEqual(['Ana', 'Souza']);
  });
});

describe('pontoAceso (grade de 8×4 com um ponto lima)', () => {
  it('fica dentro da grade e é sempre o mesmo para o mesmo número', () => {
    for (const n of ['ICML26-0001', 'ICML26-0042', 'ICML26-9999', 'sem-numero']) {
      const p = pontoAceso(n);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThan(PONTOS);
      expect(pontoAceso(n)).toBe(p);
    }
  });

  it('números seguidos acendem pontos diferentes', () => {
    const pontos = new Set(
      Array.from({ length: PONTOS }, (_, i) =>
        pontoAceso(`ICML26-${String(i + 1).padStart(4, '0')}`),
      ),
    );
    expect(pontos.size).toBe(PONTOS);
  });
});

describe('tagDoParticipante (mapeamento de Tag do Figma)', () => {
  it('Graduação = Neutral, Mestrado = Blue', () => {
    expect(tagDoParticipante('graduacao')).toEqual({
      texto: 'Participante · Graduação',
      tom: 'tag-neutra',
    });
    expect(tagDoParticipante('mestrado')).toEqual({
      texto: 'Participante · Mestrado',
      tom: 'tag-azul',
    });
  });

  it('outro ou sem vínculo: só "Participante"', () => {
    expect(tagDoParticipante('outro').texto).toBe('Participante');
    expect(tagDoParticipante(null).texto).toBe('Participante');
  });
});

describe('linhaCurso', () => {
  it('junta curso e instituição com ponto médio, ignorando vazios', () => {
    expect(linhaCurso('Ciência da Computação', 'UFAL')).toBe('Ciência da Computação · UFAL');
    expect(linhaCurso(null, 'UFAL')).toBe('UFAL');
    expect(linhaCurso('  ', null)).toBe('');
  });
});

describe('idOrganizacao', () => {
  it('três dígitos, como "id: 007"', () => {
    expect(idOrganizacao(7)).toBe('id: 007');
    expect(idOrganizacao(123)).toBe('id: 123');
  });
});

describe('linkDoQr', () => {
  it('só LinkedIn/Lattes viram QR; sem perfil, sem QR', () => {
    expect(linkDoQr('https://www.linkedin.com/in/ana')).toBe('https://www.linkedin.com/in/ana');
    expect(linkDoQr(null)).toBeNull();
    expect(linkDoQr('')).toBeNull();
    expect(linkDoQr('https://evil.com/in/ana')).toBeNull();
  });
});
