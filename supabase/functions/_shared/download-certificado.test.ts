import { describe, expect, it, vi } from 'vitest';
import { baixarCertificado, type DependenciasDownload } from './download-certificado';

const PDF = new TextEncoder().encode('%PDF-1.7 certificado sintético');
const entrada = { email: ' Ana@Exemplo.com ', numero: 'icml26-0042', turnstile: 'token-ok' };
const achado = {
  numero: 'ICML26-0042',
  nome: 'Ana Sintética',
  cpf: '52998224725',
  minutos: 830,
  codigo: 'K7QF3-M2D9A-0XB4C-TT8ZP',
};

function deps(extra: Partial<DependenciasDownload> = {}): DependenciasDownload {
  return {
    consumirLimite: vi.fn(async () => true),
    turnstileValido: vi.fn(async () => true),
    buscar: vi.fn(async () => achado),
    gerar: vi.fn(async () => PDF),
    ...extra,
  };
}

describe('download do certificado (Edge Function)', () => {
  it('com dados certos devolve o PDF com nome de arquivo', async () => {
    const d = deps();
    const r = await baixarCertificado(entrada, d);
    expect(r.status).toBe(200);
    expect(r.tipo).toBe('pdf');
    if (r.tipo === 'pdf') {
      expect(r.pdf).toBe(PDF);
      expect(r.arquivo).toBe('certificado-ICML26-0042.pdf');
    }
    expect(d.buscar).toHaveBeenCalledWith('ana@exemplo.com', 'ICML26-0042');
  });

  it('conta o limite antes de tudo e para em 429 sem consultar nada', async () => {
    const d = deps({ consumirLimite: vi.fn(async () => false) });
    const r = await baixarCertificado(entrada, d);
    expect(r.status).toBe(429);
    expect(d.turnstileValido).not.toHaveBeenCalled();
    expect(d.buscar).not.toHaveBeenCalled();
  });

  it('sem anti-robô válido → 403 sem consultar o banco', async () => {
    const d = deps({ turnstileValido: vi.fn(async () => false) });
    expect((await baixarCertificado(entrada, d)).status).toBe(403);
    expect(d.buscar).not.toHaveBeenCalled();
  });

  it('não encontrado e não liberado têm a MESMA resposta (não revela quem está inscrito)', async () => {
    const d = deps({ buscar: vi.fn(async () => null) });
    const r = await baixarCertificado(entrada, d);
    expect(r.status).toBe(404);
    expect(r.tipo).toBe('json');
    if (r.tipo === 'json') expect(r.corpo.erro).toMatch(/liberad/);
    expect(d.gerar).not.toHaveBeenCalled();
  });

  it.each([
    ['sem e-mail', { ...entrada, email: '' }],
    ['e-mail inválido', { ...entrada, email: 'ana@' }],
    ['número com caracteres estranhos', { ...entrada, numero: "ICML26-0042' or 1=1" }],
    ['corpo que não é objeto', 'texto'],
    ['sem token do anti-robô', { ...entrada, turnstile: '' }],
  ])('entrada inválida (%s) → 422 sem consultar o banco', async (_n, corpo) => {
    const d = deps();
    expect((await baixarCertificado(corpo, d)).status).toBe(422);
    expect(d.buscar).not.toHaveBeenCalled();
  });

  it('erro inesperado vira 500 genérico, sem detalhes', async () => {
    const d = deps({
      gerar: vi.fn(async () => {
        throw new Error('MODELO_ILEGIVEL interno');
      }),
    });
    const r = await baixarCertificado(entrada, d);
    expect(r.status).toBe(500);
    expect(JSON.stringify(r)).not.toContain('MODELO_ILEGIVEL');
  });
});
