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

/** Byte order mark: faz o Excel abrir o CSV como UTF-8 (acentos certos). */
export const BOM = String.fromCharCode(0xfeff);

export function gerarCsv(lista: Inscricao[]): string {
  const cabecalho = [
    'Nº de inscrição',
    'Nome',
    'E-mail',
    'CPF (mascarado)',
    'Instituição',
    'Minicurso',
    'Apresenta trabalho',
    'Título do trabalho',
    'Status do trabalho',
    'Concorre ao prêmio',
    'Inscrita em',
    'Situação',
  ];
  const linhas = lista.map((i) => [
    i.numero,
    i.nome,
    i.email,
    i.cpf_mascarado,
    i.instituicao ?? '',
    simNao(i.minicurso),
    simNao(i.apresenta_trabalho),
    i.titulo_trabalho ?? '',
    i.status_trabalho ? (STATUS_TRABALHO[i.status_trabalho] ?? i.status_trabalho) : '',
    simNao(i.concorre_premio),
    formatarDataHora(i.criada_em),
    i.cancelada ? 'Cancelada' : 'Ativa',
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
  EMAIL_JA_INSCRITO: 'Já existe outra inscrição com este e-mail.',
  CPF_JA_NO_MINICURSO: 'Este CPF já ocupa uma vaga no minicurso em outra inscrição.',
  VAGAS_ABAIXO_DAS_OCUPADAS: 'Não é possível deixar menos vagas do que as já ocupadas.',
  JANELAS_INVALIDAS: 'Confira as datas: o início precisa ser antes do fim.',
};

export function mensagemDeErro(codigo: string | undefined): string {
  return (codigo && ERROS[codigo]) || 'Não foi possível concluir. Tente de novo.';
}
