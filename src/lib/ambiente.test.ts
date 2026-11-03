import { describe, expect, it } from 'vitest';
import { textoDaFaixa } from './ambiente';

describe('textoDaFaixa', () => {
  it('sem Supabase configurado é o protótipo (nada é gravado)', () => {
    expect(textoDaFaixa({ backend: false, vercelEnv: 'production' })).toMatch(
      /Nenhuma inscrição é gravada/,
    );
  });

  it('produção não tem faixa (programação definitiva, WML-75)', () => {
    expect(textoDaFaixa({ backend: true, vercelEnv: 'production' })).toBeNull();
  });

  it('preview e ambiente local avisam que é homologação', () => {
    for (const vercelEnv of ['preview', 'development', undefined]) {
      expect(textoDaFaixa({ backend: true, vercelEnv })).toMatch(/homologação.*dados de teste/);
    }
  });
});
