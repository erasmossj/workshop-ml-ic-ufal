import { describe, expect, it, vi } from 'vitest';
import { executarExpurgo, type DependenciasExpurgo } from './expurgo';

function deps(pdfs: string[], extra: Partial<DependenciasExpurgo> = {}): DependenciasExpurgo {
  return {
    pdfsPendentes: vi.fn(async () => pdfs),
    apagarArquivos: vi.fn(async (lote: string[]) => lote),
    concluirPdfs: vi.fn(async (lote: string[]) => lote.length),
    expurgarDados: vi.fn(async () => ({ dados_pessoais: 3, participantes: 0 })),
    ...extra,
  };
}

describe('expurgo (Edge Function)', () => {
  it('apaga os PDFs vencidos em lotes de 100 e só marca os que saíram do Storage', async () => {
    const pdfs = Array.from({ length: 230 }, (_, i) => `${i}.pdf`);
    const d = deps(pdfs);
    const r = await executarExpurgo(d);
    expect(d.apagarArquivos).toHaveBeenCalledTimes(3);
    expect((d.apagarArquivos as ReturnType<typeof vi.fn>).mock.calls[0][0]).toHaveLength(100);
    expect(r).toEqual({ pdfs: 230, dados_pessoais: 3, participantes: 0 });
  });

  it('se o Storage não apagar um arquivo, ele continua pendente para o dia seguinte', async () => {
    const d = deps(['a.pdf', 'b.pdf'], {
      apagarArquivos: vi.fn(async () => ['a.pdf']),
    });
    const r = await executarExpurgo(d);
    expect(d.concluirPdfs).toHaveBeenCalledWith(['a.pdf']);
    expect(r.pdfs).toBe(1);
  });

  it('apaga os arquivos ANTES dos dados (o caminho do PDF ainda está no banco)', async () => {
    const ordem: string[] = [];
    const d = deps(['a.pdf'], {
      apagarArquivos: vi.fn(async (l: string[]) => (ordem.push('arquivos'), l)),
      expurgarDados: vi.fn(
        async () => (ordem.push('dados'), { dados_pessoais: 0, participantes: 0 }),
      ),
    });
    await executarExpurgo(d);
    expect(ordem).toEqual(['arquivos', 'dados']);
  });

  it('sem nada vencido, não chama o Storage', async () => {
    const d = deps([]);
    await executarExpurgo(d);
    expect(d.apagarArquivos).not.toHaveBeenCalled();
  });
});
