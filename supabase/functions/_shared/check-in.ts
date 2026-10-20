// Check-in do credenciamento (WML-54/55 · ADR-004), sem Supabase para ser testado com dublês.
// Ordem: entrada válida → operador logado e organizador → QR autêntico (HMAC) → RPC check_in.
// O banco também confere o operador; aqui é a primeira barreira. Nada de dado pessoal em logs.
import { erroSeguro } from './erro-seguro.ts';

export const MINICURSO_SLUG = 'ml-na-pratica';

export type Operador = { email: string; organizador: boolean };

export type ArgsCheckIn = {
  numero: string;
  dia: string;
  minicurso: string | null;
  origem: 'qr' | 'manual';
  operador: string;
};

export type RespostaCheckIn = { resultado: string; numero?: string | null; nome?: string | null };

export type DependenciasCheckIn = {
  /** Usuário do JWT da requisição; null se não houver login válido. */
  operador(): Promise<Operador | null>;
  /** Número de inscrição se o token do QR for autêntico; senão, null. */
  verificarToken(token: string): Promise<string | null>;
  checkIn(args: ArgsCheckIn): Promise<RespostaCheckIn>;
};

const DIA = /^\d{4}-\d{2}-\d{2}$/;
const NUMERO = /^[A-Za-z0-9-]{1,20}$/;
const TOKEN = /^[A-Za-z0-9_-]{1,20}\.[A-Za-z0-9_-]{1,43}$/;

type Entrada = { token?: string; numero?: string; dia: string; modo: 'dia' | 'minicurso' };

function validar(corpo: unknown): Entrada | null {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) return null;
  const c = corpo as Record<string, unknown>;
  const token = typeof c.token === 'string' ? c.token.trim() : undefined;
  const numero = typeof c.numero === 'string' ? c.numero.trim() : undefined;
  if (Boolean(token) === Boolean(numero)) return null; // exatamente um dos dois
  if (token !== undefined && !TOKEN.test(token)) return null;
  if (numero !== undefined && !NUMERO.test(numero)) return null;
  if (typeof c.dia !== 'string' || !DIA.test(c.dia)) return null;
  if (c.modo !== 'dia' && c.modo !== 'minicurso') return null;
  return { token, numero, dia: c.dia, modo: c.modo };
}

export async function realizarCheckIn(
  corpo: unknown,
  deps: DependenciasCheckIn,
): Promise<{ status: number; corpo: RespostaCheckIn | { erro: string } }> {
  const entrada = validar(corpo);
  if (!entrada) return { status: 400, corpo: { erro: 'Requisição inválida.' } };

  const operador = await deps.operador();
  if (!operador) return { status: 401, corpo: { erro: 'Entre novamente para continuar.' } };
  if (!operador.organizador) {
    return { status: 403, corpo: { erro: 'Este e-mail não tem acesso ao credenciamento.' } };
  }

  let numero: string;
  let origem: ArgsCheckIn['origem'];
  if (entrada.token) {
    const verificado = await deps.verificarToken(entrada.token);
    if (!verificado) return { status: 200, corpo: { resultado: 'qr_invalido' } };
    numero = verificado;
    origem = 'qr';
  } else {
    numero = entrada.numero!.toUpperCase();
    origem = 'manual';
  }

  try {
    const r = await deps.checkIn({
      numero,
      dia: entrada.dia,
      minicurso: entrada.modo === 'minicurso' ? MINICURSO_SLUG : null,
      origem,
      operador: operador.email,
    });
    return { status: 200, corpo: { resultado: r.resultado, numero: r.numero, nome: r.nome } };
  } catch (e) {
    console.error('check_in falhou', erroSeguro(e));
    return { status: 500, corpo: { erro: 'Erro inesperado. Tente novamente.' } };
  }
}
