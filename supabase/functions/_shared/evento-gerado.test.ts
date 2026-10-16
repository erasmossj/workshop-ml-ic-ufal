import { describe, expect, it } from 'vitest';
import { evento, eventosDeAgenda } from '../../../src/data/evento';
import { EVENTO } from './evento-gerado';

// Se falhar: o conteúdo em src/data/evento.ts mudou — rode `npm run gerar:evento`.
describe('evento-gerado.ts (cópia para as Edge Functions)', () => {
  it('está em sincronia com src/data/evento.ts', () => {
    expect(EVENTO.sigla).toBe(evento.sigla);
    expect(EVENTO.nome).toBe(evento.nome);
    expect(EVENTO.realizacao).toBe(evento.realizacao);
    expect(EVENTO.datasTexto).toBe(evento.datasTexto);
    expect(EVENTO.local).toEqual(evento.local);
    expect(EVENTO.agenda).toEqual(
      eventosDeAgenda().map((e) => ({
        ...e,
        inicio: e.inicio.toISOString(),
        fim: e.fim.toISOString(),
      })),
    );
  });
});
