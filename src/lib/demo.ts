/**
 * Persistência FALSA do protótipo (sessionStorage do navegador). Será substituída pela
 * Edge Function `register` (WML-26). Guarda só o CPF mascarado — nunca o CPF completo.
 */

export type InscricaoDemo = {
  numero: string;
  nome: string;
  cpfMascarado: string;
  email: string;
  minicurso: boolean;
  trabalho: { titulo: string; premio: boolean; nivel: string } | null;
};

const CHAVE = 'icml-demo';

/** Simula a regra "e-mail único" na demonstração. */
export const EMAIL_JA_INSCRITO = 'ja@inscrito.com';

export function gerarNumero(aleatorio: () => number = Math.random): string {
  return `ICML26-${Math.floor(aleatorio() * 9000) + 1000}`;
}

export function salvarDemo(inscricao: InscricaoDemo): void {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(inscricao));
  } catch {
    // Navegação privada ou armazenamento bloqueado: a confirmação mostra o exemplo padrão.
  }
}

export function carregarDemo(): InscricaoDemo | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as InscricaoDemo) : null;
  } catch {
    return null;
  }
}
