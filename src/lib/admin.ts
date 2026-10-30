/**
 * Lógica do painel da organização (WML-33/34), sem DOM nem Supabase para ser testada à parte.
 * CPF chega do banco já mascarado e nunca é desmascarado aqui.
 */

/** Linha de public.admin_listar_inscricoes(). */
export type Inscricao = {
  numero: string;
  nome: string;
  email: string;
  cpf_mascarado: string;
  instituicao: string | null;
  /** graduacao | mestrado | outro — null em inscrições anteriores à WML-69. */
  vinculo: string | null;
  curso: string | null;
  /** LinkedIn ou Lattes, já normalizado em https pelo banco (vira QR no crachá). */
  perfil_url: string | null;
  minicurso: boolean;
  apresenta_trabalho: boolean;
  titulo_trabalho: string | null;
  status_trabalho: string | null;
  concorre_premio: boolean;
  nivel: string | null;
  criada_em: string;
  cancelada: boolean;
  pdf_path: string | null;
  email_status: string | null;
  /** Dias com presença nas palestras (AAAA-MM-DD), do credenciamento (WML-56). */
  dias_presente: string[];
  /** Tardes do minicurso com presença (AAAA-MM-DD). */
  dias_minicurso: string[];
};

export const STATUS_TRABALHO: Record<string, string> = {
  pendente: 'Pendente',
  rejeitado: 'Rejeitado',
  aprovado_poster: 'Aprovado (pôster)',
  aprovado_oral: 'Aprovado (oral)',
};

export const NIVEL_PREMIO: Record<string, string> = {
  graduacao: 'graduação',
  mestrado: 'mestrado',
};

export const STATUS_EMAIL: Record<string, string> = {
  pendente: 'Na fila',
  enviando: 'Enviando',
  enviado: 'Enviado',
  falhou: 'Falhou',
};

// ---------------------------------------------------------------------------------------------
// Exportação CSV (Excel/Planilhas em PT-BR: separador ";" e BOM para os acentos)
// ---------------------------------------------------------------------------------------------

/** Neutraliza injeção de fórmula: célula que começa com = + - @ TAB ou CR vira texto. */
export function escaparCelula(valor: string): string {
  return /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
}

function celula(valor: string): string {
  const v = escaparCelula(valor);
  return /[;"\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const simNao = (b: boolean) => (b ? 'Sim' : 'Não');

/** Resposta de public.admin_resumo_presencas() (só contagens). */
export type ResumoPresencas = {
  dias: { dia: string; presentes: number }[];
  minicursos: { slug: string; titulo: string; dia: string; inscritos: number; presentes: number }[];
};

/** Cartões do painel: presentes por dia (palestras) e por tarde de minicurso. */
export function cartoesPresenca(r: ResumoPresencas): [string, string][] {
  return [
    ...r.dias.map((d): [string, string] => [
      `Palestras · ${formatarDias([d.dia])}`,
      `${d.presentes} ${d.presentes === 1 ? 'presente' : 'presentes'}`,
    ]),
    ...r.minicursos.map((m): [string, string] => [
      `${m.titulo} · ${formatarDias([m.dia])}`,
      `${m.presentes} de ${m.inscritos} inscritos`,
    ]),
  ];
}

/** ['2026-12-02', '2026-12-04'] → '02/12, 04/12'. */
export function formatarDias(dias: string[] | null | undefined): string {
  return (dias ?? []).map((d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`).join(', ');
}

/** Byte order mark: faz o Excel abrir o CSV como UTF-8 (acentos certos). */
export const VINCULO: Record<string, string> = {
  graduacao: 'Graduação',
  mestrado: 'Mestrado',
  outro: 'Outro',
};

export const BOM = String.fromCharCode(0xfeff);

export function gerarCsv(lista: Inscricao[]): string {
  const cabecalho = [
    'Nº de inscrição',
    'Nome',
    'E-mail',
    'CPF (mascarado)',
    'Instituição',
    'Vínculo',
    'Curso',
    'Perfil (LinkedIn/Lattes)',
    'Minicurso',
    'Apresenta trabalho',
    'Título do trabalho',
    'Status do trabalho',
    'Concorre ao prêmio',
    'Inscrita em',
    'Situação',
    'Dias presentes',
    'Tardes no minicurso',
  ];
  const linhas = lista.map((i) => [
    i.numero,
    i.nome,
    i.email,
    i.cpf_mascarado,
    i.instituicao ?? '',
    i.vinculo ? (VINCULO[i.vinculo] ?? i.vinculo) : '',
    i.curso ?? '',
    i.perfil_url ?? '',
    simNao(i.minicurso),
    simNao(i.apresenta_trabalho),
    i.titulo_trabalho ?? '',
    i.status_trabalho ? (STATUS_TRABALHO[i.status_trabalho] ?? i.status_trabalho) : '',
    simNao(i.concorre_premio),
    formatarDataHora(i.criada_em),
    i.cancelada ? 'Cancelada' : 'Ativa',
    formatarDias(i.dias_presente),
    formatarDias(i.dias_minicurso),
  ]);
  return BOM + [cabecalho, ...linhas].map((l) => l.map(celula).join(';')).join('\r\n');
}

// ---------------------------------------------------------------------------------------------
// Filtros e paginação
// ---------------------------------------------------------------------------------------------

export type Filtros = {
  busca?: string;
  minicurso?: 'todos' | 'sim' | 'nao';
  /** 'com' | 'sem' | um status de trabalho. */
  trabalho?: string;
  situacao?: 'ativas' | 'canceladas' | 'todas';
};

const normalizar = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function filtrar(lista: Inscricao[], f: Filtros): Inscricao[] {
  const termo = normalizar(f.busca?.trim() ?? '');
  const situacao = f.situacao ?? 'ativas';
  return lista.filter((i) => {
    if (situacao === 'ativas' && i.cancelada) return false;
    if (situacao === 'canceladas' && !i.cancelada) return false;
    if (f.minicurso === 'sim' && !i.minicurso) return false;
    if (f.minicurso === 'nao' && i.minicurso) return false;
    if (f.trabalho === 'com' && !i.apresenta_trabalho) return false;
    if (f.trabalho === 'sem' && i.apresenta_trabalho) return false;
    if (f.trabalho && !['todos', 'com', 'sem'].includes(f.trabalho)) {
      if (i.status_trabalho !== f.trabalho) return false;
    }
    return !termo || normalizar(`${i.nome} ${i.email} ${i.numero}`).includes(termo);
  });
}

export function paginar<T>(lista: T[], pagina: number, tamanho: number) {
  const paginas = Math.max(1, Math.ceil(lista.length / tamanho));
  const atual = Math.min(Math.max(1, pagina), paginas);
  return {
    itens: lista.slice((atual - 1) * tamanho, atual * tamanho),
    pagina: atual,
    paginas,
    total: lista.length,
  };
}

// ---------------------------------------------------------------------------------------------
// Datas — America/Maceio é UTC−03:00 o ano todo (sem horário de verão)
// ---------------------------------------------------------------------------------------------

const FUSO_MS = 3 * 60 * 60 * 1000;

export function formatarDataHora(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Maceio',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
    .format(new Date(iso))
    .replace(',', '');
}

/** ISO → valor de <input type="datetime-local"> no horário de Maceió. */
export function paraInputLocal(iso: string): string {
  return new Date(new Date(iso).getTime() - FUSO_MS).toISOString().slice(0, 16);
}

/** Valor de <input type="datetime-local"> (horário de Maceió) → ISO com fuso explícito. */
export function deInputLocal(valor: string): string {
  return `${valor}:00-03:00`;
}

// ---------------------------------------------------------------------------------------------
// Mensagens
// ---------------------------------------------------------------------------------------------

const ERROS: Record<string, string> = {
  NAO_AUTORIZADO: 'Este e-mail não tem acesso ao painel. Fale com a coordenação do evento.',
  INSCRICAO_INEXISTENTE: 'Inscrição não encontrada.',
  INSCRICAO_CANCELADA: 'Esta inscrição está cancelada.',
  NOME_INVALIDO: 'Informe nome e sobrenome, só com letras.',
  CPF_INVALIDO: 'CPF inválido. Confira os números.',
  EMAIL_INVALIDO: 'E-mail inválido.',
  INSTITUICAO_INVALIDA: 'Instituição muito longa (máximo de 160 caracteres).',
  VINCULO_INVALIDO: 'Escolha o vínculo: graduação, mestrado ou outro.',
  CURSO_INVALIDO: 'Curso muito longo (máximo de 120 caracteres).',
  PERFIL_INVALIDO: 'Use um link do LinkedIn (linkedin.com/in/…) ou do Lattes (lattes.cnpq.br/…).',
  EMAIL_JA_INSCRITO: 'Já existe outra inscrição com este e-mail.',
  CPF_JA_NO_MINICURSO: 'Este CPF já ocupa uma vaga no minicurso em outra inscrição.',
  VAGAS_ABAIXO_DAS_OCUPADAS: 'Não é possível deixar menos vagas do que as já ocupadas.',
  JANELAS_INVALIDAS: 'Confira as datas: o início precisa ser antes do fim.',
  CARGA_INVALIDA: 'Confira a carga horária (até 24 horas) e o título da atividade.',
  ATIVIDADE_INEXISTENTE: 'Atividade não encontrada. Recarregue a página.',
  MODELO_INVALIDO: 'O modelo não foi encontrado. Envie o PDF de novo.',
  CAMPOS_INVALIDOS: 'Confira as posições: página, tamanho (6 a 72) e largura.',
  MODELO_INCOMPLETO: 'Salve o modelo e as posições antes de liberar os certificados.',
};

export function mensagemDeErro(codigo: string | undefined): string {
  return (codigo && ERROS[codigo]) || 'Não foi possível concluir. Tente de novo.';
}
