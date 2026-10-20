/**
 * Lógica das páginas de certificado (WML-58..60 · ADR-005), sem DOM para ser testada.
 * O código segue a base32 de Crockford do servidor: XXXXX-XXXXX-XXXXX-XXXXX.
 */
export { formatarCargaHoraria } from '../../supabase/functions/_shared/carga-horaria';

/** Código como a pessoa digitou → formato canônico, ou null se não tiver 20 caracteres. */
export function normalizarCodigo(texto: string): string | null {
  const v = texto
    .replace(/[^0-9A-Za-z]/g, '')
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1');
  if (v.length !== 20) return null;
  return v.match(/.{5}/g)!.join('-');
}

/** Data de emissão (ISO) → DD/MM/AAAA no fuso de Maceió. */
export function formatarEmissao(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Maceio',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(iso));
}
