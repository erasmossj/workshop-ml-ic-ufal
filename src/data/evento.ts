/**
 * Conteúdo do evento — ÚNICA fonte para o site. Baseado no relatório de planejamento
 * (reuniões de 02/10 e 15/10/2026). Itens "a confirmar" devem ser atualizados aqui.
 * Horários no fuso America/Maceio (UTC-03:00, sem horário de verão).
 */

export const evento = {
  sigla: 'IC-ML 2026',
  nome: 'Workshop de Machine Learning do IC',
  realizacao: 'IEEE Ramo Estudantil UFAL · IEEE Computer Society UFAL · Instituto de Computação',
  resumo:
    'Três dias para conhecer a pesquisa local em aprendizado de máquina: palestras e apresentações de trabalhos pela manhã, minicurso prático à tarde.',
  objetivo:
    'Apresentar os avanços da pesquisa local à comunidade acadêmica e incentivar o ingresso na área — especialmente de alunos recém-matriculados ou de quem quer se aprofundar.',
  publico: 'Alunos de graduação e mestrado do IC, aberto a outras unidades e instituições.',
  datasTexto: '02 a 04 de dezembro de 2026',
  local: {
    nome: 'Instituto de Computação — UFAL',
    detalhe: 'Manhãs no mini-auditório do IC · tardes no Laboratório 1',
    endereco:
      'Campus A. C. Simões · Av. Lourival Melo Mota, s/n · Tabuleiro do Martins · Maceió/AL',
    mapa: 'https://www.google.com/maps/search/?api=1&query=Instituto+de+Computa%C3%A7%C3%A3o+UFAL+Macei%C3%B3',
  },
  /** E-mail público do evento (rodapé, FAQ e política de privacidade). */
  contato: 'ic-ml@ic.ufal.br',
  /** Crachá da organização (Figma: faixa lima "ORGANIZAÇÃO · STAFF · 02—04.12"). */
  cracha: { faixa: 'Staff · 02—04.12' },
  /** Hero (Figma "Hero — site oficial"): linha de data/local e texto de apoio. */
  hero: {
    linha: ['02—04.DEZ.2026', 'Instituto de Computação', 'UFAL'],
    texto:
      'Três dias de palestras, apresentações de pesquisa local e um minicurso prático de ML no Google Colab.',
    /** Números do rodapé do hero (13 = vagas para apresentação de trabalhos). */
    numeros: [
      { valor: '03', rotulo: 'dias' },
      { valor: '03', rotulo: 'tardes de minicurso' },
      { valor: '13', rotulo: 'apresentações' },
    ],
  },
} as const;

export type Atividade = {
  inicio: string;
  fim: string;
  titulo: string;
  tipo: 'pausa' | 'palestra' | 'trabalhos' | 'minicurso' | 'cerimonia';
};

/**
 * Programação conforme o documento atualizado da organização (WML-71). 02/12 é quarta-feira.
 * O credenciamento é só no Dia 1; o check-in de presença por dia não depende dele.
 */
export const dias: { rotulo: string; data: string; semana: string; atividades: Atividade[] }[] = [
  {
    rotulo: 'Dia 1',
    data: '2026-12-02',
    semana: 'Qua · 02/12',
    atividades: [
      { inicio: '08:00', fim: '09:00', titulo: 'Credenciamento', tipo: 'pausa' },
      { inicio: '09:00', fim: '10:00', titulo: 'Abertura formal', tipo: 'cerimonia' },
      {
        inicio: '10:00',
        fim: '12:00',
        titulo: 'Palestra de abertura — Prof. George Darmiton',
        tipo: 'palestra',
      },
      { inicio: '12:00', fim: '13:30', titulo: 'Almoço', tipo: 'pausa' },
      {
        inicio: '13:30',
        fim: '17:10',
        titulo: 'Minicurso — Dia 1: Fundamentos',
        tipo: 'minicurso',
      },
    ],
  },
  {
    rotulo: 'Dia 2',
    data: '2026-12-03',
    semana: 'Qui · 03/12',
    atividades: [
      { inicio: '08:00', fim: '10:00', titulo: 'Apresentações de trabalhos', tipo: 'trabalhos' },
      { inicio: '10:00', fim: '10:30', titulo: 'Coffee break', tipo: 'pausa' },
      { inicio: '10:30', fim: '12:30', titulo: 'Apresentações de trabalhos', tipo: 'trabalhos' },
      { inicio: '12:30', fim: '13:30', titulo: 'Almoço', tipo: 'pausa' },
      {
        inicio: '13:30',
        fim: '17:10',
        titulo: 'Minicurso — Dia 2: Classificação e Regressão',
        tipo: 'minicurso',
      },
    ],
  },
  {
    rotulo: 'Dia 3',
    data: '2026-12-04',
    semana: 'Sex · 04/12',
    atividades: [
      { inicio: '08:00', fim: '10:30', titulo: 'Apresentações de trabalhos', tipo: 'trabalhos' },
      { inicio: '10:30', fim: '11:00', titulo: 'Coffee break', tipo: 'pausa' },
      {
        inicio: '11:00',
        fim: '12:00',
        titulo: 'Palestra — Mercado de trabalho em ML · Hugo Souza',
        tipo: 'palestra',
      },
      { inicio: '12:00', fim: '13:00', titulo: 'Encerramento', tipo: 'cerimonia' },
      { inicio: '13:00', fim: '13:40', titulo: 'Almoço', tipo: 'pausa' },
      {
        inicio: '13:40',
        fim: '17:20',
        titulo: 'Minicurso — Dia 3: Clustering e Séries Temporais',
        tipo: 'minicurso',
      },
    ],
  },
];

/** Seção "Quem vai falar" da home — mesmos horários das palestras em `dias` (conferido por teste). */
export const palestras = [
  {
    dia: 'Qua · 02/12',
    inicio: '10:00',
    titulo: 'Palestra de abertura',
    quem: 'Prof. George Darmiton',
  },
  {
    dia: 'Sex · 04/12',
    inicio: '11:00',
    titulo: 'Mercado de trabalho em ML',
    quem: 'Hugo Souza',
  },
] as const;

export const minicurso = {
  titulo: 'Minicurso de Machine Learning na prática',
  resumo:
    'Três tardes de mão na massa no Google Colab — sem instalar nada. O pré-processamento de dados entra ao longo das aulas, conforme a necessidade prática.',
  /** Uma tarde por dia; os títulos aparecem também em `dias` (conferido por teste). */
  dias: [
    { titulo: 'Fundamentos', detalhe: 'Python, Pandas e análise exploratória de dados' },
    {
      titulo: 'Classificação e Regressão',
      detalhe: 'Aprendizado supervisionado: prever categorias e valores',
    },
    {
      titulo: 'Clustering e Séries Temporais',
      detalhe: 'Agrupamento não supervisionado e predição de séries temporais',
    },
  ],
  /** Capacidade total do Laboratório 1. */
  vagas: 48,
} as const;

/**
 * Chamada de trabalhos (seção "Apresente sua pesquisa"). Sem artigo, PDF nem premiação (WML-75).
 * Avaliação, resultado e cronograma são da organização interna: não vão para o site.
 */
export const trabalhos = {
  formato: 'Título, autores e um resumo de até 1.500 caracteres. Não é preciso enviar artigo.',
  campos:
    'Na inscrição, marque “Vou submeter trabalho” e preencha os três campos. Sem anexar arquivo.',
  prazo: 'De 30/10 a 16/11/2026, junto com as inscrições (pode ser prorrogado até 18/11).',
  /** Vagas para apresentação no evento. Não limita inscrições nem submissões. */
  vagasApresentacao: 13,
  vagasTexto: 'O evento tem 13 vagas para apresentação de trabalhos.',
} as const;

/** Janela de inscrição e submissão (horário de Maceió). */
export const janela = {
  inicio: '2026-10-30T00:00:00-03:00',
  fim: '2026-11-16T23:59:59-03:00',
  textoProrrogacao: 'pode ser prorrogada até 18/11',
  /** Cabeçalho do formulário (Figma: "30.10 → 16.11"). */
  textoCurto: '30.10 → 16.11',
} as const;

export const faq = [
  {
    p: 'Preciso me inscrever no minicurso?',
    r: 'Só se quiser participar. A inscrição no evento já dá acesso a todas as palestras e apresentações; o minicurso é opcional e tem vagas limitadas pelo laboratório.',
  },
  {
    p: 'Preciso instalar alguma coisa para o minicurso?',
    r: 'Não. Tudo roda no Google Colab, direto no navegador. Leve um notebook se puder; o laboratório também tem computadores.',
  },
  {
    p: 'Como recebo o certificado?',
    r: 'Por e-mail, com a carga horária das atividades em que você esteve presente. Por isso pedimos nome completo, CPF e e-mail.',
  },
  {
    p: 'Errei meus dados. E agora?',
    r: `Escreva para ${evento.contato} — a correção é feita pela organização.`,
  },
] as const;

/**
 * Política de privacidade (WML-38, LGPD). Aprovada pela organização em 03/11/2026 (versão
 * 2026-11-03). Mudou o texto? Atualize `versao` e volte `aprovada` para false até a nova
 * aprovação: o aceite de
 * cada participante fica em participantes.consentimento_em e vale a versão em vigor naquela data.
 * 2026-11-03 (WML-73 · ADR-007): acervo de edições passadas, só para trabalho aprovado e com
 * autorização separada. Quem aceitou a versão 2026-10-19 não entra no acervo sem autorizar.
 * WML-75 (mesmo dia): trabalho passa a ser só título, autores e resumo; PDF só de quem enviou
 * até 03/11/2026.
 */
export const privacidade = {
  versao: '2026-11-03',
  /** false = a página mostra o aviso de minuta. */
  aprovada: true,
  controlador:
    'O IEEE Ramo Estudantil UFAL, que organiza o IC-ML 2026 junto com o IEEE Computer Society UFAL e o Instituto de Computação da UFAL, decide como seus dados são usados.',
  dados: [
    {
      dado: 'Nome completo, CPF e e-mail',
      motivo: 'identificar sua inscrição, enviar o comprovante e emitir o certificado',
    },
    { dado: 'Instituição (opcional)', motivo: 'conhecer o público do evento' },
    {
      dado: "Vínculo (estudante, docente ou outro) e, se você escolher 'outro', uma descrição curta escrita por você (até 40 caracteres), além de curso e perfil no LinkedIn ou Lattes (opcionais)",
      motivo: 'montar o seu crachá; o perfil vira um QR Code impresso nele',
    },
    { dado: 'Inscrição no minicurso', motivo: 'controlar as vagas do laboratório' },
    {
      dado: 'Título, autores e resumo do trabalho, se você submeter',
      motivo: 'avaliação pela banca e montagem da programação',
    },
    {
      dado: 'Título, autores e resumo do trabalho aprovado (e o PDF, se você enviou um até 03/11/2026), se você autorizar',
      motivo: 'acervo de edições passadas do IC-ML',
    },
    {
      dado: 'Data e hora em que você aceitou esta política e, se for o caso, autorizou o acervo',
      motivo: 'comprovar o consentimento',
    },
  ],
  baseLegal:
    'Seu consentimento (art. 7º, I, da LGPD), dado ao marcar a caixa de aceite no formulário. O acervo de edições passadas tem um consentimento à parte, específico e destacado (art. 8º, § 4º): uma caixa própria, desmarcada, que você só marca se quiser. Você pode revogá-lo a qualquer momento (art. 8º, § 5º), sem perder a inscrição. Não pedimos nenhum dado além do necessário para o evento.',
  operadores: [
    {
      nome: 'Supabase',
      papel: 'guarda o banco de dados e os arquivos (servidores nos Estados Unidos)',
    },
    { nome: 'Vercel', papel: 'hospeda o site' },
    { nome: 'Cloudflare Turnstile', papel: 'verifica que o formulário não é preenchido por robô' },
    { nome: 'Google (Gmail)', papel: 'envia os e-mails do evento' },
    { nome: 'Brevo', papel: 'envia os e-mails se o Gmail falhar' },
  ],
  compartilhamento:
    'Esses serviços só tratam os dados para executar a tarefa deles, e alguns ficam fora do Brasil (transferência internacional, art. 33 da LGPD). Não vendemos nem cedemos seus dados a ninguém. Nome e trabalho aprovado aparecem na programação do evento. Quando a página de edições passadas do IC-ML existir, título, autores e resumo dos trabalhos do acervo (e o PDF, quando houver) ficarão públicos nela — nunca CPF ou e-mail.',
  retencao: [
    {
      dados:
        'PDFs de trabalhos enviados até 03/11/2026, se você não autorizou o acervo ou o trabalho não foi aprovado',
      ate: '2027-01-31',
    },
    {
      dados:
        "CPF, e-mail, instituição, curso, perfil (LinkedIn/Lattes) e a descrição do vínculo 'outro'",
      ate: '2027-03-31',
    },
    {
      dados: 'Nome, nº de inscrição e carga horária do certificado',
      ate: '2031-12-31',
      motivo: 'para que qualquer pessoa possa validar a autenticidade do certificado',
    },
  ],
  /**
   * Acervo de edições passadas (WML-73): a única retenção sem data, e só com o consentimento
   * separado. Sem `ate` de propósito — não há data inventada; vale até a retirada.
   */
  retencaoAcervo: {
    dados:
      'Título, autores e resumo do trabalho aprovado (e o PDF, se enviado até 03/11/2026), se você autorizou o acervo',
    prazo: 'enquanto o acervo de edições passadas existir, ou até você pedir a retirada',
    detalhe:
      'O acervo não guarda CPF, e-mail nem qualquer ligação com a sua inscrição. Se pedir a retirada, título, autores e resumo saem na hora e o PDF, se houver, é apagado no prazo normal dos PDFs ou, se ele já tiver passado, em até 1 dia.',
  },
  retencaoObs:
    'Cópias de segurança são criptografadas e apagadas automaticamente em até 14 dias. Se você cancelar a inscrição, seus dados são apagados no mesmo prazo acima, ou antes, se pedir.',
  seguranca: [
    'Só a organização acessa os dados, com login individual.',
    'O CPF aparece mascarado (ex.: ***.456.789-**) nas telas e planilhas da organização.',
    'Os PDFs enviados até 03/11/2026 ficam em área privada, sem link público.',
    'Toda conexão com o site é criptografada (HTTPS).',
    'Nenhum dado pessoal vai para registros (logs) do sistema.',
  ],
  direitos: [
    'Confirmar se tratamos seus dados e ter acesso a eles.',
    'Pedir a correção de dados incompletos ou errados.',
    'Pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários.',
    'Saber sobre o compartilhamento dos seus dados: com quem e para quê (veja a lista acima).',
    'Fazer a revogação do consentimento a qualquer momento. Antes do evento, isso cancela a inscrição e o certificado.',
    'Retirar a autorização do acervo a qualquer momento, sem afetar a inscrição nem o certificado.',
    'Reclamar à Autoridade Nacional de Proteção de Dados (ANPD).',
  ],
} as const;

/** Atividades em formato de agenda (para .ics e Google Agenda). */
export function eventosDeAgenda() {
  return dias.map((d) => {
    const primeira = d.atividades[0];
    const ultima = d.atividades[d.atividades.length - 1];
    return {
      uid: `icml2026-${d.data}@workshop-ml-ic-ufal`,
      titulo: `${evento.sigla} — ${d.rotulo}`,
      inicio: new Date(`${d.data}T${primeira.inicio}:00-03:00`),
      fim: new Date(`${d.data}T${ultima.fim}:00-03:00`),
      local: `${evento.local.nome}, Maceió`,
      descricao: d.atividades.map((a) => `${a.inicio} ${a.titulo}`).join('\n'),
    };
  });
}
