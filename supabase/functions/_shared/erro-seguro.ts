// Sem dependências de propósito: a função `register` importa daqui e não resolve os pacotes da
// `send-emails` (qrcode, nodemailer), que só existem no deno.json dela.

/** Mensagem de erro própria para guardar ou logar: sem e-mail, sem CPF, até 300 caracteres. */
export function erroSeguro(e: unknown): string {
  const bruto = e instanceof Error ? e.message : typeof e === 'string' ? e : 'erro desconhecido';
  return bruto
    .replace(/[^\s<>()"']+@[^\s<>()"']+/g, '[e-mail]')
    .replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, '[cpf]')
    .slice(0, 300);
}
