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

  it('o PDF que fica até 31/01/2027 é o de quem NÃO autorizou o acervo ou não foi aprovado', () => {
    const pdf = privacidade.retencao.find((r) => /PDF/.test(r.dados));
    expect(pdf?.dados).toMatch(/não autorizou o acervo/);
    expect(pdf?.dados).toMatch(/não foi aprovado/);
  });

  // Acervo de edições passadas (WML-73 · ADR-007): a ÚNICA exceção à minimização, e só com
  // consentimento específico, destacado e revogável.
  describe('acervo de edições passadas', () => {
    it('é a única retenção sem data, e não vale para CPF', () => {
      expect('ate' in privacidade.retencaoAcervo).toBe(false);
      expect(privacidade.retencaoAcervo.dados).toMatch(/aprovado/);
      expect(privacidade.retencaoAcervo.dados).toMatch(/se você autorizou/);
      expect(privacidade.retencaoAcervo.dados).not.toMatch(/CPF|e-mail/);
      expect(privacidade.retencaoAcervo.prazo).toMatch(/retirada/);
    });

    it('diz que o acervo não guarda CPF nem e-mail', () => {
      expect(privacidade.retencaoAcervo.detalhe).toMatch(/não guarda CPF, e-mail/);
    });

    it('aparece nos dados coletados, só com autorização', () => {
      const item = privacidade.dados.find((d) => /acervo/.test(d.motivo));
      expect(item?.dado).toMatch(/aprovado, se você autorizar/);
      expect(item?.motivo).toBe('acervo de edições passadas do IC-ML');
    });

    it('tem base legal própria: consentimento específico e destacado, revogável', () => {
      expect(privacidade.baseLegal).toMatch(/art\. 7º, I/);
      expect(privacidade.baseLegal).toMatch(/art\. 8º, § 4º/);
      expect(privacidade.baseLegal).toMatch(/art\. 8º, § 5º/);
      expect(privacidade.baseLegal).toMatch(/desmarcada/);
    });

    it('avisa que título, autores, resumo e PDF ficarão públicos na página de edições passadas', () => {
      expect(privacidade.compartilhamento).toMatch(/edições passadas/);
      expect(privacidade.compartilhamento).toMatch(/título, autores, resumo e PDF/);
    });

    it('a retirada do acervo é um direito separado da inscrição', () => {
      expect(privacidade.direitos.join(' ')).toMatch(/autorização do acervo/);
    });
  });

  it('descreve o vínculo "outro" com texto livre de até 40 caracteres', () => {
    const vinculo = privacidade.dados.find((d) => /Vínculo/.test(d.dado));
    expect(vinculo?.dado).toMatch(/estudante, docente ou outro/);
    expect(vinculo?.dado).toMatch(/até 40 caracteres/);
    expect(vinculo?.motivo).toMatch(/crachá/);
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
