import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { montarEmailConfirmacao, type DadosConfirmacao } from './email-confirmacao';
import { verificarToken } from './qr';

const SEGREDO = 'segredo-de-teste-com-pelo-menos-32-caracteres';
const base: DadosConfirmacao = {
  numero: 'ICML26-0042',
  nome: 'Participante Sintética da Silva',
  email: 'participante@exemplo.com',
  cpfMascarado: '***.982.247-**',
  minicurso: null,
  trabalho: null,
};
const montar = (extra: Partial<DadosConfirmacao> = {}, siteUrl?: string) =>
  montarEmailConfirmacao(
    { ...base, ...extra },
    { segredoQr: SEGREDO, agora: new Date('2026-11-01T12:00:00Z'), siteUrl },
  );

describe('montarEmailConfirmacao', () => {
  it('vai para o e-mail da inscrição com o número no assunto', async () => {
    const m = await montar();
    expect(m.para).toBe('participante@exemplo.com');
    expect(m.assunto).toBe('IC-ML 2026 · Inscrição confirmada · ICML26-0042');
  });

  it('cumprimenta pelo primeiro nome e traz número, datas e local', async () => {
    const m = await montar();
    for (const corpo of [m.texto, m.html]) {
      expect(corpo).toContain('Participante');
      expect(corpo).toContain('ICML26-0042');
      expect(corpo).toContain('02 a 04 de dezembro de 2026');
      expect(corpo).toContain('Instituto de Computação — UFAL');
    }
    expect(m.texto).toMatch(/^Olá, Participante!/);
  });

  it('informa minicurso e trabalho quando existem', async () => {
    const sem = await montar();
    expect(sem.texto).not.toContain('Minicurso:');
    const com = await montar({ minicurso: 'ML na prática', trabalho: 'Redes neurais' });
    expect(com.texto).toContain('Minicurso: ML na prática');
    expect(com.texto).toContain('Trabalho submetido: Redes neurais');
    expect(com.html).toContain('ML na prática');
  });

  it('traz um link do Google Agenda para cada dia do evento', async () => {
    const m = await montar();
    const links = m.html.match(/https:\/\/calendar\.google\.com\/calendar\/render\?[^"]+/g) ?? [];
    expect(links).toHaveLength(3);
    expect(m.texto.match(/https:\/\/calendar\.google\.com/g)).toHaveLength(3);
  });

  it('anexa o comprovante em PDF e o .ics com os 3 dias', async () => {
    const m = await montar();
    expect(m.anexos.map((a) => a.nome)).toEqual(['comprovante-ICML26-0042.pdf', 'ic-ml-2026.ics']);
    const [pdf, ics] = m.anexos;
    expect(pdf.tipo).toBe('application/pdf');
    expect(new TextDecoder().decode(pdf.conteudo.slice(0, 5))).toBe('%PDF-');
    expect((await PDFDocument.load(pdf.conteudo)).getPageCount()).toBe(1);
    expect(ics.tipo).toMatch(/^text\/calendar/);
    expect(new TextDecoder().decode(ics.conteudo).match(/BEGIN:VEVENT/g)).toHaveLength(3);
  });

  it('o QR do comprovante usa um token assinado do número', async () => {
    const m = await montar();
    expect(m.qr).toMatch(/^ICML26-0042\./);
    expect(await verificarToken(m.qr, SEGREDO)).toBe('ICML26-0042');
  });

  it('escapa HTML vindo do participante (nome e títulos)', async () => {
    const m = await montar({
      nome: 'Ana <script>alert(1)</script>',
      trabalho: '<img src=x onerror=alert(1)>',
    });
    expect(m.html).not.toContain('<script>');
    expect(m.html).not.toContain('<img src=x');
    expect(m.html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('mostra só o CPF mascarado', async () => {
    const m = await montar();
    expect(m.texto).toContain('***.982.247-**');
    expect(`${m.texto}${m.html}`).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  });

  it('inclui o link do site quando configurado', async () => {
    expect((await montar()).texto).not.toContain('vercel.app');
    const m = await montar({}, 'https://workshop-ml-ic-ufal.vercel.app');
    expect(m.texto).toContain('https://workshop-ml-ic-ufal.vercel.app');
    expect(m.html).toContain('href="https://workshop-ml-ic-ufal.vercel.app"');
  });
});
