import { describe, expect, it, vi } from 'vitest';
import { realizarCheckIn, type DependenciasCheckIn } from './check-in';

const ORG = 'org@exemplo.com';

function deps(extra: Partial<DependenciasCheckIn> = {}): DependenciasCheckIn {
  return {
    operador: vi.fn(async () => ({ email: ORG, organizador: true })),
    verificarToken: vi.fn(async (t: string) =>
      t === 'ICML26-0042.assinatura-ok' ? 'ICML26-0042' : null,
    ),
    checkIn: vi.fn(async (a) => ({
      resultado: 'ok',
      numero: a.numero.toUpperCase(),
      nome: 'Ana Sintética',
    })),
    ...extra,
  };
}

describe('check-in (Edge Function)', () => {
  it('QR válido no modo Dia: verifica a assinatura e registra com origem qr', async () => {
    const d = deps();
    const r = await realizarCheckIn(
      { token: 'ICML26-0042.assinatura-ok', dia: '2026-12-02', modo: 'dia' },
      d,
    );
    expect(r).toEqual({
      status: 200,
      corpo: { resultado: 'ok', numero: 'ICML26-0042', nome: 'Ana Sintética' },
    });
    expect(d.checkIn).toHaveBeenCalledWith({
      numero: 'ICML26-0042',
      dia: '2026-12-02',
      minicurso: null,
      origem: 'qr',
      operador: ORG,
    });
  });

  it('modo Minicurso envia o slug do minicurso', async () => {
    const d = deps();
    await realizarCheckIn(
      { token: 'ICML26-0042.assinatura-ok', dia: '2026-12-03', modo: 'minicurso' },
      d,
    );
    expect(d.checkIn).toHaveBeenCalledWith(
      expect.objectContaining({ minicurso: 'ml-na-pratica', dia: '2026-12-03' }),
    );
  });

  it('busca manual pelo número registra com origem manual, sem token', async () => {
    const d = deps();
    const r = await realizarCheckIn({ numero: ' icml26-0007 ', dia: '2026-12-04', modo: 'dia' }, d);
    expect(r.status).toBe(200);
    expect(d.verificarToken).not.toHaveBeenCalled();
    expect(d.checkIn).toHaveBeenCalledWith(
      expect.objectContaining({ numero: 'ICML26-0007', origem: 'manual' }),
    );
  });

  it('QR forjado ou adulterado não chega ao banco', async () => {
    const d = deps();
    const r = await realizarCheckIn(
      { token: 'ICML26-0042.assinatura-falsa', dia: '2026-12-02', modo: 'dia' },
      d,
    );
    expect(r).toEqual({ status: 200, corpo: { resultado: 'qr_invalido' } });
    expect(d.checkIn).not.toHaveBeenCalled();
  });

  it('sem login → 401; logado sem ser organizador → 403; nada chega ao banco', async () => {
    const semLogin = deps({ operador: vi.fn(async () => null) });
    expect(
      (await realizarCheckIn({ numero: 'ICML26-0001', dia: '2026-12-02', modo: 'dia' }, semLogin))
        .status,
    ).toBe(401);
    expect(semLogin.checkIn).not.toHaveBeenCalled();

    const intruso = deps({
      operador: vi.fn(async () => ({ email: 'intruso@exemplo.com', organizador: false })),
    });
    expect(
      (await realizarCheckIn({ numero: 'ICML26-0001', dia: '2026-12-02', modo: 'dia' }, intruso))
        .status,
    ).toBe(403);
    expect(intruso.checkIn).not.toHaveBeenCalled();
  });

  it.each([
    ['corpo vazio', null],
    ['texto solto', 'ICML26-0001'],
    [
      'token e número juntos',
      { token: 'a.b', numero: 'ICML26-0001', dia: '2026-12-02', modo: 'dia' },
    ],
    ['nem token nem número', { dia: '2026-12-02', modo: 'dia' }],
    ['modo desconhecido', { numero: 'ICML26-0001', dia: '2026-12-02', modo: 'tarde' }],
    ['dia mal formatado', { numero: 'ICML26-0001', dia: '02/12/2026', modo: 'dia' }],
    [
      'número com caracteres estranhos',
      { numero: "ICML26-0001' or 1=1", dia: '2026-12-02', modo: 'dia' },
    ],
    ['token gigante', { token: 'x'.repeat(200), dia: '2026-12-02', modo: 'dia' }],
  ])('entrada inválida (%s) → 400 sem tocar no banco', async (_nome, entrada) => {
    const d = deps();
    const r = await realizarCheckIn(entrada, d);
    expect(r.status).toBe(400);
    expect(d.checkIn).not.toHaveBeenCalled();
  });

  it('erro inesperado do banco vira 500 genérico', async () => {
    const d = deps({
      checkIn: vi.fn(async () => {
        throw new Error('falha qualquer');
      }),
    });
    const r = await realizarCheckIn({ numero: 'ICML26-0001', dia: '2026-12-02', modo: 'dia' }, d);
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.corpo)).not.toContain('falha qualquer');
  });
});
