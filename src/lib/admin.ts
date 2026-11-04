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
  /** estudante | docente | outro (WML-72) — null em inscrições anteriores à WML-69. */
  vinculo: string | null;
  /** Texto livre do vínculo "Outro" (até 40 caracteres); null nos demais. */
  vinculo_outro: string | null;
  curso: string | null;
  /** LinkedIn ou Lattes, já normalizado em https pelo banco (vira QR no crachá). */
  perfil_url: string | null;
  minicurso: boolean;
  apresenta_trabalho: boolean;
  titulo_trabalho: string | null;
  /** Autores e resumo do trabalho (WML-79: a organização corrige pelo painel). */
  autores_trabalho: string | null;
  resumo_trabalho: string | null;
  status_trabalho: string | null;
  criada_em: string;
  cancelada: boolean;
  pdf_path: string | null;
  email_status: string | null;
  /** Dias com presença nas palestras (AAAA-MM-DD), do credenciamento (WML-56). */
  dias_presente: string[];
  /** Tardes do minicurso com presença (AAAA-MM-DD). */
  dias_minicurso: string[];
  /** Autorizou o acervo de edições passadas (WML-73) — false sem trabalho. */
  acervo: boolean;
};

export const STATUS_TRABALHO: Record<string, string> = {
  pendente: 'Pendente',
  rejeitado: 'Rejeitado',
  aprovado_poster: 'Aprovado (pôster)',
  aprovado_oral: 'Aprovado (oral)',
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

// ---------------------------------------------------------------------------------------------
// Acervo de edições passadas (WML-73 · ADR-007): só aprovados e com autorização expressa
// ---------------------------------------------------------------------------------------------

export function rotuloAcervo(acervo: boolean): string {
  return `Autorizou acervo: ${acervo ? 'sim' : 'não'}`;
}

/** Botão do painel: registra a autorização recebida por e-mail ou a retira (revogação). */
export function acaoAcervo(i: Pick<Inscricao, 'numero' | 'acervo'>): {
  novo: boolean;
  botao: string;
  confirmacao: string;
} {
  return i.acervo
    ? {
        novo: false,
        botao: 'Retirar do acervo',
        confirmacao:
          `Retirar o trabalho de ${i.numero} do acervo? Título, autores e resumo saem na hora; ` +
          'o PDF, se houver (enviado até 03/11/2026), é apagado na próxima rodada do expurgo.',
      }
    : {
        novo: true,
        botao: 'Registrar autorização do acervo',
        confirmacao:
          `Confirma que o autor de ${i.numero} autorizou por escrito (e-mail) manter o trabalho no ` +
          'acervo de edições passadas? Só trabalhos aprovados entram no acervo.',
      };
}

/**
 * Botão do painel: inclui ou tira do minicurso depois da inscrição (admin_alterar_minicurso).
 * null = sem botão: inscrição cancelada, ou já com presença no minicurso (o banco recusaria).
 */
export function acaoMinicurso(
  i: Pick<Inscricao, 'numero' | 'minicurso' | 'dias_minicurso' | 'cancelada'>,
): { inscrever: boolean; botao: string; confirmacao: string } | null {
  if (i.cancelada) return null;
  if (!i.minicurso) {
    return {
      inscrever: true,
      botao: 'Incluir no minicurso',
      confirmacao:
        `Incluir ${i.numero} no minicurso? Ocupa uma vaga (se ainda houver) e a pessoa recebe ` +
        'um e-mail com o comprovante atualizado.',
    };
  }
  if (i.dias_minicurso?.length) return null;
  return {
    inscrever: false,
    botao: 'Tirar do minicurso',
    confirmacao:
      `Tirar ${i.numero} do minicurso? A vaga é liberada, a inscrição nas palestras continua e a ` +
      'pessoa recebe um e-mail com o comprovante atualizado.',
  };
}

// ---------------------------------------------------------------------------------------------
// Trabalho pela organização (WML-79): incluir, corrigir ou retirar (admin_salvar_trabalho /
// admin_retirar_trabalho). As regras valem no banco; aqui só adiantam o aviso no formulário.
// ---------------------------------------------------------------------------------------------

export type DadosTrabalho = { titulo: string; autores: string; resumo: string };

/** Mesmos limites de public.trabalhos (e da inscrição), em caracteres. */
export const LIMITES_TRABALHO = {
  titulo: [3, 250],
  autores: [3, 600],
  resumo: [10, 1500],
} as const;

const umEspaco = (t: string) => t.trim().replace(/\s+/g, ' ');

/** Como o banco: título e autores numa linha só; o resumo só perde os espaços das pontas. */
export function normalizarTrabalho(d: DadosTrabalho): DadosTrabalho {
  return { titulo: umEspaco(d.titulo), autores: umEspaco(d.autores), resumo: d.resumo.trim() };
}

/** Código de erro do banco (mesmo texto de mensagemDeErro) ou null quando está tudo certo. */
export function validarTrabalho(d: DadosTrabalho): string | null {
  const n = normalizarTrabalho(d);
  // [...t]: conta pontos de código, como char_length no Postgres (emoji = 1).
  const fora = (t: string, [min, max]: readonly [number, number]) =>
    [...t].length < min || [...t].length > max;
  if (fora(n.titulo, LIMITES_TRABALHO.titulo)) return 'TITULO_INVALIDO';
  if (fora(n.autores, LIMITES_TRABALHO.autores)) return 'AUTORES_INVALIDOS';
  if (fora(n.resumo, LIMITES_TRABALHO.resumo)) return 'RESUMO_INVALIDO';
  return null;
}

/**
 * Botões do trabalho no painel. null = sem botões (inscrição cancelada: o banco recusaria).
 * Retirar apaga só o trabalho; a inscrição (e o minicurso) continua. Sem e-mail automático.
 */
export function acaoTrabalho(
  i: Pick<Inscricao, 'numero' | 'apresenta_trabalho' | 'cancelada'>,
): { editar: string; retirar: { botao: string; confirmacao: string } | null } | null {
  if (i.cancelada) return null;
  if (!i.apresenta_trabalho) return { editar: 'Incluir trabalho', retirar: null };
  return {
    editar: 'Corrigir trabalho',
    retirar: {
      botao: 'Retirar trabalho',
      confirmacao:
        `Retirar o trabalho de ${i.numero}? Título, autores e resumo são apagados (e saem do ` +
        'acervo, se estiverem lá). A inscrição continua, com o minicurso se houver. ' +
        'Nenhum e-mail é enviado: use "Reenviar" se quiser mandar o comprovante atualizado.',
    },
  };
}

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

export const VINCULO: Record<string, string> = {
  estudante: 'Estudante',
  docente: 'Docente',
  outro: 'Outro',
};

/** "Estudante", "Docente", "Outro: <texto da pessoa>" — '' sem vínculo. */
export function rotuloVinculo(vinculo: string | null, vinculoOutro: string | null): string {
  if (!vinculo) return '';
  const rotulo = VINCULO[vinculo] ?? vinculo;
  return vinculo === 'outro' && vinculoOutro ? `${rotulo}: ${vinculoOutro}` : rotulo;
}

/** Byte order mark: faz o Excel abrir o CSV como UTF-8 (acentos certos). */
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
    'Autores do trabalho',
    'Status do trabalho',
    'Autorizou acervo',
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
    rotuloVinculo(i.vinculo, i.vinculo_outro),
    i.curso ?? '',
    i.perfil_url ?? '',
    simNao(i.minicurso),
    simNao(i.apresenta_trabalho),
    i.titulo_trabalho ?? '',
    i.autores_trabalho ?? '',
    i.status_trabalho ? (STATUS_TRABALHO[i.status_trabalho] ?? i.status_trabalho) : '',
    i.apresenta_trabalho ? simNao(i.acervo) : '',
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
  VINCULO_INVALIDO: 'Escolha o vínculo: estudante, docente ou outro.',
  VINCULO_OUTRO_INVALIDO:
    'Descreva o vínculo "Outro" em até 40 caracteres (o texto só vale para "Outro").',
  CURSO_INVALIDO: 'Curso muito longo (máximo de 120 caracteres).',
  PERFIL_INVALIDO: 'Use um link do LinkedIn (linkedin.com/in/…) ou do Lattes (lattes.cnpq.br/…).',
  PERFIL_OBRIGATORIO:
    'O perfil no LinkedIn ou no Lattes é obrigatório: informe o link (não dá para apagar).',
  EMAIL_JA_INSCRITO: 'Já existe outra inscrição com este e-mail.',
  CPF_JA_NO_MINICURSO: 'Este CPF já ocupa uma vaga no minicurso em outra inscrição.',
  MINICURSO_ESGOTADO:
    'As vagas do minicurso acabaram. Aumente as vagas em Configuração, se houver lugar.',
  MINICURSO_FECHADO: 'O minicurso ainda está fechado: defina as vagas em Configuração.',
  MINICURSO_COM_PRESENCA: 'Esta pessoa já tem presença no minicurso e não pode ser tirada dele.',
  MINICURSO_INEXISTENTE: 'Minicurso não encontrado. Recarregue a página.',
  VAGAS_ABAIXO_DAS_OCUPADAS: 'Não é possível deixar menos vagas do que as já ocupadas.',
  JANELAS_INVALIDAS: 'Confira as datas: o início precisa ser antes do fim.',
  CARGA_INVALIDA: 'Confira a carga horária (até 24 horas) e o título da atividade.',
  ATIVIDADE_INEXISTENTE: 'Atividade não encontrada. Recarregue a página.',
  MODELO_INVALIDO: 'O modelo não foi encontrado. Envie o PDF de novo.',
  CAMPOS_INVALIDOS: 'Confira as posições: página, tamanho (6 a 72) e largura.',
  MODELO_INCOMPLETO: 'Salve o modelo e as posições antes de liberar os certificados.',
  SEM_TRABALHO: 'Esta inscrição não submeteu trabalho.',
  TITULO_INVALIDO: 'O título do trabalho precisa ter de 3 a 250 caracteres.',
  AUTORES_INVALIDOS: 'Os autores do trabalho precisam ter de 3 a 600 caracteres.',
  RESUMO_INVALIDO: 'O resumo do trabalho precisa ter de 10 a 1.500 caracteres.',
  ACERVO_INVALIDO: 'Informe se o autor autorizou (sim ou não).',
  ACERVO_INEXISTENTE: 'Trabalho não encontrado no acervo.',
};

export function mensagemDeErro(codigo: string | undefined): string {
  return (codigo && ERROS[codigo]) || 'Não foi possível concluir. Tente de novo.';
}
