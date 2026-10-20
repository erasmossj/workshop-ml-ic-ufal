// Texto seguro para as fontes padrão do PDF (Helvetica/Times, WinAnsi), usado no comprovante e no
// certificado. Sem dependências: as funções importam daqui sem carregar pacotes umas das outras.

/** Troca caracteres que a fonte padrão não codifica: tira o acento ou usa "?". */
export function paraWinAnsi(texto: string, suportados: Set<number>): string {
  let saida = '';
  for (const c of texto) {
    if (suportados.has(c.codePointAt(0)!)) {
      saida += c;
      continue;
    }
    const base = c.normalize('NFD').replace(/\p{M}/gu, '');
    saida += [...base].every((b) => suportados.has(b.codePointAt(0)!)) && base ? base : '?';
  }
  return saida;
}
