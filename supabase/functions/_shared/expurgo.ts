// Expurgo LGPD (WML-52 · S6), sem Supabase para ser testado. Primeiro os PDFs vencidos saem do
// Storage (pela API: apagar a linha do banco não apaga o arquivo); só os que saíram são marcados.
// Depois o banco apaga CPF, e-mail e instituição ou as inscrições, conforme o prazo vencido.

export type DependenciasExpurgo = {
  pdfsPendentes(): Promise<string[]>;
  /** Apaga do bucket `trabalhos`; devolve os caminhos que de fato saíram. */
  apagarArquivos(caminhos: string[]): Promise<string[]>;
  concluirPdfs(caminhos: string[]): Promise<number>;
  expurgarDados(): Promise<{ dados_pessoais: number; participantes: number }>;
};

const LOTE = 100;

export async function executarExpurgo(d: DependenciasExpurgo) {
  const pendentes = await d.pdfsPendentes();
  let pdfs = 0;
  for (let i = 0; i < pendentes.length; i += LOTE) {
    const apagados = await d.apagarArquivos(pendentes.slice(i, i + LOTE));
    if (apagados.length) pdfs += await d.concluirPdfs(apagados);
  }
  const dados = await d.expurgarDados();
  return { pdfs, ...dados };
}
