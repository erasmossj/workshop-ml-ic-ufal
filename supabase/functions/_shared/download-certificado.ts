// Download do certificado pelo participante (WML-60 · ADR-005), sem Supabase para ser testado.
// Ordem: limite por origem → entrada válida → Turnstile → busca por e-mail + nº → PDF na hora.
// "Não encontrado" e "ainda não liberado" têm a mesma resposta: não revela quem está inscrito.
import { erroSeguro } from './erro-seguro.ts';

export type DadosParaPdf = {
  numero: string;
  nome: string;
  cpf: string;
  minutos: number;
  codigo: string;
};

export type DependenciasDownload = {
  consumirLimite(): Promise<boolean>;
  turnstileValido(token: string): Promise<boolean>;
  /** Certificado emitido para esse e-mail + número (inscrição ativa), ou null. */
  buscar(email: string, numero: string): Promise<DadosParaPdf | null>;
  gerar(dados: DadosParaPdf): Promise<Uint8Array>;
};

export type RespostaDownload =
  | { status: 200; tipo: 'pdf'; pdf: Uint8Array; arquivo: string }
  | { status: number; tipo: 'json'; corpo: { erro: string } };

const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;
const NUMERO = /^[A-Za-z0-9-]{1,20}$/;

const erro = (status: number, mensagem: string): RespostaDownload => ({
  status,
  tipo: 'json',
  corpo: { erro: mensagem },
});

export async function baixarCertificado(
  corpo: unknown,
  deps: DependenciasDownload,
): Promise<RespostaDownload> {
  // 1. Limite por origem: conta toda tentativa, válida ou não.
  if (!(await deps.consumirLimite())) {
    return erro(429, 'Muitas tentativas. Aguarde alguns minutos e tente de novo.');
  }

  // 2. Entrada.
  const c =
    corpo && typeof corpo === 'object' && !Array.isArray(corpo)
      ? (corpo as Record<string, unknown>)
      : {};
  const email = typeof c.email === 'string' ? c.email.trim().toLowerCase() : '';
  const numero = typeof c.numero === 'string' ? c.numero.trim().toUpperCase() : '';
  const token = typeof c.turnstile === 'string' ? c.turnstile : '';
  if (email.length > 254 || !EMAIL.test(email) || !NUMERO.test(numero) || !token) {
    return erro(422, 'Informe o e-mail e o número de inscrição do comprovante.');
  }

  // 3. Anti-robô.
  if (!(await deps.turnstileValido(token))) {
    return erro(
      403,
      'Não foi possível confirmar que você não é um robô. Recarregue a página e tente de novo.',
    );
  }

  try {
    const dados = await deps.buscar(email, numero);
    if (!dados) {
      return erro(
        404,
        'Não encontramos certificado liberado para esse e-mail e número. Confira os dados do comprovante; os certificados são liberados depois do evento.',
      );
    }
    return {
      status: 200,
      tipo: 'pdf',
      pdf: await deps.gerar(dados),
      arquivo: `certificado-${dados.numero}.pdf`,
    };
  } catch (e) {
    console.error('download do certificado falhou', erroSeguro(e));
    return erro(500, 'Erro inesperado. Tente novamente em instantes.');
  }
}
