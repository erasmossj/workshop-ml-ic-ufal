import { describe, expect, it } from 'vitest';
import { dias, privacidade } from './evento';

// Política de privacidade (WML-38): regras que o texto precisa respeitar (LGPD, RNF03).
const fimDoEvento = new Date(`${dias.at(-1)!.data}T23:59:59-03:00`);
const dataMaceio = (iso: string) => new Date(`${iso}T23:59:59-03:00`);
const MESES = 30 * 86_400_000;

describe('política de privacidade', () => {
  it('tem versão datada (AAAA-MM-DD) que não está no futuro', () => {
    expect(privacidade.versao).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(dataMaceio(privacidade.versao).getTime()).toBeLessThanOrEqual(
      dataMaceio(new Date().toISOString().slice(0, 10)).getTime() + 86_400_000,
    );
  });

  it('todo prazo de retenção é uma data válida depois do evento', () => {
    expect(privacidade.retencao.length).toBeGreaterThan(0);
    for (const r of privacidade.retencao) {
      expect(r.ate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(dataMaceio(r.ate).getTime()).toBeGreaterThan(fimDoEvento.getTime());
    }
  });

  it('CPF e PDFs dos trabalhos não ficam mais de 6 meses depois do evento (minimização)', () => {
    const sensiveis = privacidade.retencao.filter((r) => /CPF|PDF/.test(r.dados));
    expect(sensiveis.length).toBeGreaterThanOrEqual(2);
    for (const r of sensiveis) {
      expect(dataMaceio(r.ate).getTime() - fimDoEvento.getTime()).toBeLessThanOrEqual(6 * MESES);
    }
  });

  it('declara cada serviço externo que trata dados pessoais', () => {
    const nomes = privacidade.operadores.map((o) => o.nome).join(' | ');
    for (const servico of ['Supabase', 'Vercel', 'Cloudflare', 'Google', 'Brevo']) {
      expect(nomes).toContain(servico);
    }
  });

  it('lista os direitos do titular do art. 18 da LGPD', () => {
    const texto = privacidade.direitos.join(' ').toLowerCase();
    for (const direito of ['acesso', 'correção', 'eliminação', 'revogação', 'compartilhamento']) {
      expect(texto).toContain(direito);
    }
  });
});
