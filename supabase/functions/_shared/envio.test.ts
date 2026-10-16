import { describe, expect, it, vi } from 'vitest';
import { erroSeguro, processarFila, type Fila, type ItemFila, type Provedor } from './envio';
import type { Mensagem } from './email-confirmacao';

const item = (id: number, extra: Partial<ItemFila> = {}): ItemFila => ({
  id,
  tipo: 'confirmacao',
  tentativas: 1,
  numero: `ICML26-000${id}`,
  nome: 'Participante Sintética',
  email: `p${id}@exemplo.com`,
  cpf_mascarado: '***.982.247-**',
  minicurso: null,
  trabalho: null,
  ...extra,
});

const mensagem = (i: ItemFila): Mensagem => ({
  para: i.email,
  assunto: `assunto ${i.numero}`,
  texto: 't',
  html: 'h',
  anexos: [],
  qr: `${i.numero}.x`,
});

function filaFalsa(itens: ItemFila[]) {
  const concluidos: { id: number; ok: boolean; provedor: string | null; erro: string | null }[] =
    [];
  const fila: Fila = {
    reservar: vi.fn(async () => itens),
    concluir: vi.fn(async (id, r) => {
      concluidos.push({
        id,
        ok: r.ok,
        provedor: r.ok ? r.provedor : null,
        erro: r.ok ? null : r.erro,
      });
    }),
  };
  return { fila, concluidos };
}

const provedor = (nome: Provedor['nome'], falha?: (m: Mensagem) => Error | undefined) => {
  const enviados: string[] = [];
  const p: Provedor = {
    nome,
    enviar: async (m) => {
      const e = falha?.(m);
      if (e) throw e;
      enviados.push(m.para);
    },
  };
  return { p, enviados };
};

describe('processarFila', () => {
  it('reserva o lote, envia pelo provedor principal e conclui cada item', async () => {
    const { fila, concluidos } = filaFalsa([item(1), item(2)]);
    const gmail = provedor('gmail');
    const r = await processarFila({
      fila,
      provedores: [gmail.p],
      montar: async (i) => mensagem(i),
      lote: 7,
    });
    expect(fila.reservar).toHaveBeenCalledWith(7);
    expect(gmail.enviados).toEqual(['p1@exemplo.com', 'p2@exemplo.com']);
    expect(concluidos).toEqual([
      { id: 1, ok: true, provedor: 'gmail', erro: null },
      { id: 2, ok: true, provedor: 'gmail', erro: null },
    ]);
    expect(r).toEqual({ reservados: 2, enviados: 2, falhas: 0 });
  });

  it('usa o provedor de reserva quando o principal falha', async () => {
    const { fila, concluidos } = filaFalsa([item(1)]);
    const gmail = provedor('gmail', () => new Error('454 4.7.0 Too many login attempts'));
    const brevo = provedor('brevo');
    await processarFila({
      fila,
      provedores: [gmail.p, brevo.p],
      montar: async (i) => mensagem(i),
      lote: 10,
    });
    expect(brevo.enviados).toEqual(['p1@exemplo.com']);
    expect(concluidos[0]).toMatchObject({ ok: true, provedor: 'brevo' });
  });

  it('registra falha (sem dado pessoal) quando todos os provedores falham', async () => {
    const { fila, concluidos } = filaFalsa([item(1), item(2)]);
    const gmail = provedor('gmail', (m) =>
      m.para === 'p1@exemplo.com' ? new Error(`550 caixa inexistente <${m.para}>`) : undefined,
    );
    const r = await processarFila({
      fila,
      provedores: [gmail.p],
      montar: async (i) => mensagem(i),
      lote: 10,
    });
    expect(concluidos[0]).toEqual({
      id: 1,
      ok: false,
      provedor: null,
      erro: 'gmail: 550 caixa inexistente <[e-mail]>',
    });
    expect(concluidos[1]).toMatchObject({ id: 2, ok: true });
    expect(r).toEqual({ reservados: 2, enviados: 1, falhas: 1 });
  });

  it('falha ao montar a mensagem não chama provedor e não derruba o lote', async () => {
    const { fila, concluidos } = filaFalsa([item(1, { tipo: 'certificado' }), item(2)]);
    const gmail = provedor('gmail');
    await processarFila({
      fila,
      provedores: [gmail.p],
      montar: async (i) => {
        if (i.tipo !== 'confirmacao') throw new Error('TIPO_NAO_SUPORTADO');
        return mensagem(i);
      },
      lote: 10,
    });
    expect(gmail.enviados).toEqual(['p2@exemplo.com']);
    expect(concluidos[0]).toMatchObject({ id: 1, ok: false, erro: 'montagem: TIPO_NAO_SUPORTADO' });
  });

  it('sem provedor configurado, cada item volta para a fila com erro claro', async () => {
    const { fila, concluidos } = filaFalsa([item(1)]);
    await processarFila({ fila, provedores: [], montar: async (i) => mensagem(i), lote: 10 });
    expect(concluidos[0]).toMatchObject({ ok: false, erro: 'nenhum provedor configurado' });
  });
});

describe('erroSeguro', () => {
  it('tira e-mails e CPFs e limita o tamanho', () => {
    expect(erroSeguro(new Error('falhou para ana@exemplo.com (529.982.247-25)'))).toBe(
      'falhou para [e-mail] ([cpf])',
    );
    expect(erroSeguro(new Error('x'.repeat(1000)))).toHaveLength(300);
    expect(erroSeguro('texto solto')).toBe('texto solto');
    expect(erroSeguro(undefined)).toBe('erro desconhecido');
  });
});
