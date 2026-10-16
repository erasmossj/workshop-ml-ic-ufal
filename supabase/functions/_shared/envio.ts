// Processamento da fila de e-mail (WML-29): reserva um lote no banco (teto diário lá),
// tenta os provedores em ordem (Gmail → Brevo) e informa o resultado de cada item.
// Independente de Supabase/SMTP para ser testado com dublês. Erros saem sem dado pessoal.
import type { Mensagem } from './email-confirmacao.ts';

/** Linha devolvida por public.reservar_emails (CPF já mascarado). */
export type ItemFila = {
  id: number;
  tipo: 'confirmacao' | 'certificado';
  tentativas: number;
  numero: string;
  nome: string;
  email: string;
  cpf_mascarado: string;
  minicurso: string | null;
  trabalho: string | null;
};

export type Resultado = { ok: true; provedor: Provedor['nome'] } | { ok: false; erro: string };

export type Fila = {
  reservar(lote: number): Promise<ItemFila[]>;
  concluir(id: number, resultado: Resultado): Promise<void>;
};

export type Provedor = { nome: 'gmail' | 'brevo'; enviar(m: Mensagem): Promise<void> };

/** Mensagem de erro própria para guardar: sem e-mail, sem CPF, até 300 caracteres. */
export function erroSeguro(e: unknown): string {
  const bruto = e instanceof Error ? e.message : typeof e === 'string' ? e : 'erro desconhecido';
  return bruto
    .replace(/[^\s<>()"']+@[^\s<>()"']+/g, '[e-mail]')
    .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, '[cpf]')
    .slice(0, 300);
}

async function enviarComReserva(m: Mensagem, provedores: Provedor[]): Promise<Resultado> {
  if (provedores.length === 0) return { ok: false, erro: 'nenhum provedor configurado' };
  const erros: string[] = [];
  for (const p of provedores) {
    try {
      await p.enviar(m);
      return { ok: true, provedor: p.nome };
    } catch (e) {
      erros.push(`${p.nome}: ${erroSeguro(e)}`);
    }
  }
  return { ok: false, erro: erroSeguro(erros.join(' | ')) };
}

export async function processarFila(opcoes: {
  fila: Fila;
  provedores: Provedor[];
  montar: (item: ItemFila) => Promise<Mensagem>;
  lote: number;
}): Promise<{ reservados: number; enviados: number; falhas: number }> {
  const itens = await opcoes.fila.reservar(opcoes.lote);
  let enviados = 0;
  for (const item of itens) {
    let resultado: Resultado;
    try {
      resultado = await enviarComReserva(await opcoes.montar(item), opcoes.provedores);
    } catch (e) {
      resultado = { ok: false, erro: `montagem: ${erroSeguro(e)}` };
    }
    if (resultado.ok) enviados++;
    await opcoes.fila.concluir(item.id, resultado);
  }
  return { reservados: itens.length, enviados, falhas: itens.length - enviados };
}
