import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { Campos } from './certificado';
import { montarEmailCertificado } from './email-certificado';

const campo = { pagina: 0, x: 100, y: 200, largura: 600, tamanho: 20 } as const;
const campos: Campos = {
  nome: { ...campo, alinhamento: 'centro', fonte: 'helvetica-negrito' },
  cpf: { ...campo, y: 240, alinhamento: 'centro', fonte: 'helvetica' },
  horas: { ...campo, y: 280, alinhamento: 'centro', fonte: 'helvetica' },
};

async function modelo() {
  const pdf = await PDFDocument.create();
  pdf.addPage([841.89, 595.28]);
  return pdf.save();
}

const dados = {
  numero: 'ICML26-0042',
  nome: 'Ana Sintética',
  email: 'ana@exemplo.com',
  cpf: '52998224725',
  minutos: 830,
  codigo: 'K7QF3-M2D9A-0XB4C-TT8ZP',
};
const opcoes = async () => ({ modelo: await modelo(), campos, siteUrl: 'https://exemplo.com/' });

describe('e-mail do certificado', () => {
  it('vai para o participante com o PDF anexado e o código de validação', async () => {
    const m = await montarEmailCertificado(dados, await opcoes());
    expect(m.para).toBe('ana@exemplo.com');
    expect(m.assunto).toBe('IC-ML 2026 · Seu certificado · ICML26-0042');
    expect(m.anexos).toHaveLength(1);
    expect(m.anexos[0].nome).toBe('certificado-ICML26-0042.pdf');
    expect(new TextDecoder().decode(m.anexos[0].conteudo.slice(0, 5))).toBe('%PDF-');
    expect(m.texto).toContain('13h50');
    expect(m.texto).toContain('https://exemplo.com/validar?codigo=K7QF3-M2D9A-0XB4C-TT8ZP');
    expect(m.texto).toContain('https://exemplo.com/certificado');
  });

  it('escapa o nome no HTML', async () => {
    const m = await montarEmailCertificado(
      { ...dados, nome: '<i>Ana</i> Sintética' },
      await opcoes(),
    );
    expect(m.html).toContain('&lt;i&gt;Ana&lt;/i&gt;');
    expect(m.html).not.toContain('<i>Ana</i>');
  });

  it('não põe o CPF no corpo do e-mail (só dentro do PDF)', async () => {
    const m = await montarEmailCertificado(dados, await opcoes());
    for (const corpo of [m.texto, m.html]) expect(corpo).not.toMatch(/529\.?982\.?247-?25/);
  });
});
