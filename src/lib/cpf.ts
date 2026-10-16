/** Utilitários de CPF. Nunca registre o CPF em logs — use `mascararCpf` em qualquer saída. */

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '');
}

function digitoVerificador(base: string): number {
  const pesoInicial = base.length + 1;
  const soma = [...base].reduce((acc, d, i) => acc + Number(d) * (pesoInicial - i), 0);
  const resto = (soma * 10) % 11;
  return resto === 10 ? 0 : resto;
}

export function cpfValido(valor: string): boolean {
  const cpf = somenteDigitos(valor);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const d1 = digitoVerificador(cpf.slice(0, 9));
  const d2 = digitoVerificador(cpf.slice(0, 9) + d1);
  return cpf.endsWith(`${d1}${d2}`);
}

/** Máscara progressiva para o campo do formulário: 000.000.000-00. */
export function formatarCpf(valor: string): string {
  const d = somenteDigitos(valor).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4');
}

/** Exibe só os 6 dígitos centrais (***.456.789-**), como no padrão do gov.br. */
export function mascararCpf(valor: string): string {
  const d = somenteDigitos(valor);
  if (d.length !== 11) return '***.***.***-**';
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}
