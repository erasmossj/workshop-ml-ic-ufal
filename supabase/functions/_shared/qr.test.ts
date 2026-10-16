import { describe, expect, it } from 'vitest';
import { assinarInscricao, verificarToken } from './qr';

const SEGREDO = 'segredo-de-teste-com-tamanho-suficiente';

describe('token assinado do QR (credenciamento)', () => {
  it('carrega o número de inscrição e uma assinatura curta', async () => {
    const token = await assinarInscricao('ICML26-0042', SEGREDO);
    expect(token).toMatch(/^ICML26-0042\.[A-Za-z0-9_-]{22}$/);
  });

  it('é determinístico e verificável', async () => {
    const token = await assinarInscricao('ICML26-0042', SEGREDO);
    expect(await assinarInscricao('ICML26-0042', SEGREDO)).toBe(token);
    expect(await verificarToken(token, SEGREDO)).toBe('ICML26-0042');
  });

  it('recusa número trocado, assinatura adulterada, outro segredo e lixo', async () => {
    const token = await assinarInscricao('ICML26-0042', SEGREDO);
    const assinatura = token.split('.')[1];
    expect(await verificarToken(`ICML26-0043.${assinatura}`, SEGREDO)).toBeNull();
    expect(
      await verificarToken(token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A'), SEGREDO),
    ).toBeNull();
    expect(await verificarToken(token, 'outro-segredo-qualquer-bem-comprido')).toBeNull();
    for (const lixo of ['', 'ICML26-0042', '.', 'a.b.c', 'ICML26-0042.']) {
      expect(await verificarToken(lixo, SEGREDO)).toBeNull();
    }
  });

  it('exige segredo de pelo menos 32 caracteres', async () => {
    await expect(assinarInscricao('ICML26-0042', 'curto')).rejects.toThrow();
  });
});
