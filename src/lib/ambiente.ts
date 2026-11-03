/**
 * Texto da faixa do topo conforme o ambiente do build.
 * - sem backend (sem PUBLIC_SUPABASE_URL): protótipo, nada é gravado;
 * - produção da Vercel (VERCEL_ENV=production): site oficial, sem faixa (programação definitiva);
 * - preview/local: homologação ligada ao staging.
 */
export function textoDaFaixa(opcoes: { backend: boolean; vercelEnv?: string }): string | null {
  if (!opcoes.backend) {
    return 'Protótipo para validação — conteúdo provisório e dados fictícios. Nenhuma inscrição é gravada.';
  }
  if (opcoes.vercelEnv === 'production') {
    return null;
  }
  return 'Versão de homologação — conteúdo provisório. Use apenas dados de teste.';
}
