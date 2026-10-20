// Segredo do cabeçalho x-cron-secret (pg_cron → Edge Functions send-emails e expurgo).
// Comparação em tempo constante; segredo curto (< 32) nunca confere.

export function segredoConfere(recebido: string, esperado: string): boolean {
  if (esperado.length < 32 || recebido.length !== esperado.length) return false;
  let diferenca = 0;
  for (let i = 0; i < esperado.length; i++)
    diferenca |= esperado.charCodeAt(i) ^ recebido.charCodeAt(i);
  return diferenca === 0;
}
