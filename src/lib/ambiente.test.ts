import { describe, expect, it } from 'vitest';
import { textoDaFaixa } from './ambiente';

describe('textoDaFaixa', () => {
  it('sem Supabase configurado é o protótipo (nada é gravado)', () => {
    expect(textoDaFaixa({ backend: false, vercelEnv: 'production' })).toMatch(
      /Nenhuma inscrição é gravada/,
    );
  });

  it('produção NÃO pede dados de teste', () => {
    const texto = textoDaFaixa({ backend: true, vercelEnv: 'production' });
    expect(texto).not.toMatch(/teste|homologação/i);
    expect(texto).toMatch(/podem mudar/);
  });

  it('preview e ambiente local avisam que é homologação', () => {
    for (const vercelEnv of ['preview', 'development', undefined]) {
      expect(textoDaFaixa({ backend: true, vercelEnv })).toMatch(/homologação.*dados de teste/);
    }
  });
});
