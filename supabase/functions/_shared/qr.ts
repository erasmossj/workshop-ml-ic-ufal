// Token do QR Code de credenciamento (WML-30): "<número>.<assinatura>".
// Assinatura = HMAC-SHA256(número) truncado em 128 bits, base64url. Só o servidor tem o segredo
// (QR_HMAC_SECRET); o check-in (F5) verifica o token sem consultar dado pessoal no QR.

const BYTES_ASSINATURA = 16;

async function chave(segredo: string): Promise<CryptoKey> {
  if (segredo.length < 32) throw new Error('QR_HMAC_SECRET precisa ter pelo menos 32 caracteres.');
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(segredo),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

function base64url(bytes: Uint8Array): string {
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function assinatura(numero: string, segredo: string): Promise<string> {
  const mac = await crypto.subtle.sign(
    'HMAC',
    await chave(segredo),
    new TextEncoder().encode(numero),
  );
  return base64url(new Uint8Array(mac).slice(0, BYTES_ASSINATURA));
}

export async function assinarInscricao(numero: string, segredo: string): Promise<string> {
  return `${numero}.${await assinatura(numero, segredo)}`;
}

/** Devolve o número de inscrição se o token for autêntico; senão, null. */
export async function verificarToken(token: string, segredo: string): Promise<string | null> {
  const partes = token.split('.');
  if (partes.length !== 2 || !partes[0] || !partes[1]) return null;
  const esperada = await assinatura(partes[0], segredo);
  // Comparação em tempo constante.
  if (esperada.length !== partes[1].length) return null;
  let diferenca = 0;
  for (let i = 0; i < esperada.length; i++)
    diferenca |= esperada.charCodeAt(i) ^ partes[1].charCodeAt(i);
  return diferenca === 0 ? partes[0] : null;
}
