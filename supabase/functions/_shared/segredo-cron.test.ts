import { describe, expect, it } from 'vitest';
import { segredoConfere } from './segredo-cron';

const SEGREDO = 'segredo-de-teste-do-cron-com-32-caracteres';

describe('segredo do cron', () => {
  it('confere só o segredo exato', () => {
    expect(segredoConfere(SEGREDO, SEGREDO)).toBe(true);
    expect(segredoConfere(SEGREDO.slice(0, -1) + 'x', SEGREDO)).toBe(false);
    expect(segredoConfere('', SEGREDO)).toBe(false);
  });
  it('segredo configurado curto demais nunca confere', () => {
    expect(segredoConfere('curto', 'curto')).toBe(false);
  });
});
