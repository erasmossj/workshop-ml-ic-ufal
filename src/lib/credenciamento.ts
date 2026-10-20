/**
 * Lógica do leitor de QR do credenciamento (WML-55 · ADR-004), sem DOM nem câmera para ser testada.
 * Mensagens nunca mostram CPF ou e-mail: só nome e número, para o operador conferir com a pessoa.
 */

export type Modo = 'dia' | 'minicurso';
export type Tom = 'ok' | 'aviso' | 'erro';
export type Mensagem = { tom: Tom; titulo: string; detalhe: string };
export type RespostaCheckIn = { resultado: string; nome?: string | null; numero?: string | null };

function quem(r: RespostaCheckIn): string {
  return [r.nome, r.numero].filter(Boolean).join(' · ');
}

export function mensagemDoResultado(r: RespostaCheckIn, modo: Modo): Mensagem {
  switch (r.resultado) {
    case 'ok':
      return {
        tom: 'ok',
        titulo: modo === 'minicurso' ? 'Presença no minicurso registrada' : 'Presença registrada',
        detalhe: `${quem(r)}. Confira o nome com a pessoa.`,
      };
    case 'ja_registrado':
      return {
        tom: 'aviso',
        titulo: modo === 'minicurso' ? 'Já registrado nesta tarde' : 'Já registrado hoje',
        detalhe: `${quem(r)}. Nada mudou — pode liberar a entrada.`,
      };
    case 'nao_inscrito_minicurso':
      return {
        tom: 'erro',
        titulo: 'Não inscrito no minicurso',
        detalhe: `${quem(r)}. O minicurso tem vagas limitadas; as palestras continuam liberadas.`,
      };
    case 'cancelada':
      return {
        tom: 'erro',
        titulo: 'Inscrição cancelada',
        detalhe: `${quem(r)}. Encaminhe para a mesa da organização.`,
      };
    case 'inexistente':
      return {
        tom: 'erro',
        titulo: 'Inscrição não encontrada',
        detalhe: 'Confira o número ou encaminhe para a mesa da organização.',
      };
    case 'qr_invalido':
      return {
        tom: 'erro',
        titulo: 'QR Code inválido',
        detalhe: 'Não é um comprovante do evento. Use a busca manual pelo nome ou número.',
      };
    case 'dia_invalido':
      return {
        tom: 'erro',
        titulo: 'Dia fora do evento',
        detalhe: 'Escolha um dos dias do evento no topo da tela.',
      };
    default:
      return {
        tom: 'erro',
        titulo: 'Resultado inesperado',
        detalhe: 'Tente de novo. Se continuar, avise o responsável técnico.',
      };
  }
}

/** Data de hoje (AAAA-MM-DD) no fuso de Maceió. */
export function hojeEmMaceio(agora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Maceio',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

/** Hoje, se for dia de evento; senão, o primeiro dia (ensaio e demonstração). */
export function diaPadrao(hoje: string, dias: string[]): string {
  return dias.includes(hoje) ? hoje : dias[0];
}

const TOKEN = /^[A-Za-z0-9_-]{1,20}\.[A-Za-z0-9_-]{1,43}$/;

/** Token do comprovante (`<número>.<assinatura>`) ou null se o QR não for de inscrição. */
export function tokenDoQr(texto: string): string | null {
  const t = texto.trim();
  return TOKEN.test(t) ? t : null;
}

/** A câmera lê o mesmo QR várias vezes por segundo: só deixa passar de novo após `janelaMs`. */
export function criarFiltroRepeticao(janelaMs: number): (texto: string, agora: number) => boolean {
  const vistos = new Map<string, number>();
  return (texto, agora) => {
    const ultimo = vistos.get(texto);
    if (ultimo !== undefined && agora - ultimo <= janelaMs) return false;
    vistos.set(texto, agora);
    return true;
  };
}
