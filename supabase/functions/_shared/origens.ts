// Origens permitidas no CORS das Edge Functions (WML-11).
// ALLOWED_ORIGINS: lista separada por vírgula. Cada item é uma origem exata ou um padrão com `*`,
// usado só no staging para os previews da Vercel (ex.: https://workshop-ml-ic-ufal-*-erasmo-junior.vercel.app).
// O `*` vale um trecho de letras, números e hífens dentro de um único rótulo: não atravessa pontos.
// Padrões em que o `*` ocupa um rótulo inteiro (`https://*.vercel.app`, `*`) são ignorados,
// porque liberariam qualquer site hospedado no mesmo domínio. Curinga só com https.

const TRECHO = '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?';
const ROTULO_INTEIRO = /(^|\/\/|\.)\*($|\.|:)/;

function padraoParaRegex(padrao: string): RegExp | null {
  if (!padrao.startsWith('https://') || ROTULO_INTEIRO.test(padrao)) return null;
  const partes = padrao.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\/-]/g, '\\$&'));
  return new RegExp(`^${partes.join(TRECHO)}$`);
}

export function criarVerificadorDeOrigem(lista: string): (origem: string) => boolean {
  const itens = lista
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const exatas = new Set(itens.filter((o) => !o.includes('*')));
  const padroes = itens
    .filter((o) => o.includes('*'))
    .map(padraoParaRegex)
    .filter((r): r is RegExp => r !== null);
  return (origem) => exatas.has(origem) || padroes.some((r) => r.test(origem));
}
