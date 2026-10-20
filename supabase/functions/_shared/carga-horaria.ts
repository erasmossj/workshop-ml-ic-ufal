// Formatação do certificado sem dependências: usada no PDF (Edge Functions) e nas páginas do site.

/** 1320 → "22 horas"; 60 → "1 hora"; 830 → "13h50". */
export function formatarCargaHoraria(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (m === 0) return `${h} ${h === 1 ? 'hora' : 'horas'}`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

export function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}
