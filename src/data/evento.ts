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
  /** E-mail público do evento — a definir (não publicar a conta de testes). */
  contato: null as string | null,
  /** Crachá da organização (Figma: faixa lima "ORGANIZAÇÃO · STAFF · 02—04.12"). */
  cracha: { faixa: 'Staff · 02—04.12' },
  /** Hero (Figma "Hero — site oficial"): linha de data/local e texto de apoio. */
  hero: {
    linha: ['02—04.DEZ.2026', 'Instituto de Computação', 'UFAL'],
    texto:
      'Três dias de palestras, apresentações de pesquisa local e um minicurso prático de ML no Google Colab.',
    /** Números do rodapé do hero. "apresentações" a confirmar com a banca. */
    numeros: [
      { valor: '03', rotulo: 'dias' },
      { valor: '04', rotulo: 'aulas de minicurso' },
      { valor: '12', rotulo: 'apresentações' },
    ],
  },
} as const;

export type Atividade = {
  inicio: string;
  fim: string;
  titulo: string;
  tipo: 'pausa' | 'palestra' | 'trabalhos' | 'minicurso' | 'cerimonia';
};

/** 02/12 é quarta-feira (o relatório marcava "terça" por engano). */
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
        titulo: 'Palestra de abertura — pesquisador convidado',
        tipo: 'palestra',
      },
      { inicio: '12:00', fim: '13:30', titulo: 'Almoço', tipo: 'pausa' },
      { inicio: '13:30', fim: '17:10', titulo: 'Minicurso — aula 1', tipo: 'minicurso' },
    ],
  },
  {
    rotulo: 'Dia 2',
    data: '2026-12-03',
    semana: 'Qui · 03/12',
    atividades: [
      { inicio: '08:00', fim: '08:30', titulo: 'Credenciamento', tipo: 'pausa' },
      {
        inicio: '08:30',
        fim: '12:30',
        titulo: 'Apresentações de trabalhos (coffee break às 10h)',
        tipo: 'trabalhos',
      },
      { inicio: '12:30', fim: '13:30', titulo: 'Almoço', tipo: 'pausa' },
      { inicio: '13:30', fim: '17:10', titulo: 'Minicurso — aula 2', tipo: 'minicurso' },
    ],
  },
  {
    rotulo: 'Dia 3',
    data: '2026-12-04',
    semana: 'Sex · 04/12',
    atividades: [
      { inicio: '08:00', fim: '08:30', titulo: 'Credenciamento', tipo: 'pausa' },
      { inicio: '08:30', fim: '10:30', titulo: 'Apresentações de trabalhos', tipo: 'trabalhos' },
      { inicio: '10:30', fim: '11:00', titulo: 'Coffee break', tipo: 'pausa' },
      {
        inicio: '11:00',
        fim: '12:00',
        titulo: 'Palestra — ML e ciência de dados no mercado',
        tipo: 'palestra',
      },
      { inicio: '12:00', fim: '13:00', titulo: 'Encerramento e premiação', tipo: 'cerimonia' },
      { inicio: '13:00', fim: '13:40', titulo: 'Almoço', tipo: 'pausa' },
      { inicio: '13:40', fim: '17:20', titulo: 'Minicurso — aula 3', tipo: 'minicurso' },
    ],
  },
];

export const minicurso = {
  titulo: 'Minicurso de Machine Learning na prática',
  resumo:
    'Três tardes de mão na massa no Google Colab — sem instalar nada. Quatro blocos, cada um com um instrutor; pré-processamento entra conforme a necessidade prática.',
  blocos: [
    {
      n: '01',
      titulo: 'Fundamentos',
      detalhe: 'Python, Pandas, análise exploratória de dados e Colab',
    },
    { n: '02', titulo: 'Classificação', detalhe: 'Aprendizado supervisionado' },
    { n: '03', titulo: 'Regressão e clustering', detalhe: 'Supervisionado e não supervisionado' },
    { n: '04', titulo: 'Séries temporais', detalhe: 'Predição de séries temporais' },
  ],
  /** null = número de vagas ainda não definido pela organização. */
  vagas: null as number | null,
  /** Somente para a demonstração do protótipo. */
  vagasRestantesDemo: 18,
} as const;

export const trabalhos = {
  formato:
    'Short paper no modelo da SBC, com 4 ou 6 páginas (sem contar referências), em PDF de até 5 MB.',
  campos: 'Título, autores, resumo e o PDF — tudo no próprio formulário de inscrição.',
  avaliacao:
    'A banca indica: aprovado para apresentação oral, aprovado para pôster ou não aprovado.',
  premiacao:
    'Melhor trabalho de graduação e melhor trabalho de mestrado. Marque na inscrição se quer concorrer. Prêmio: certificado e brinde.',
} as const;

/** Janela de inscrição e submissão (horário de Maceió). */
export const janela = {
  inicio: '2026-10-30T00:00:00-03:00',
  fim: '2026-11-16T23:59:59-03:00',
  textoProrrogacao: 'pode ser prorrogada até 18/11',
  /** Cabeçalho do formulário (Figma: "30.10 → 16.11"). */
  textoCurto: '30.10 → 16.11',
} as const;

export const cronograma = [
  { data: '26/10', item: 'Site no ar' },
  { data: '30/10', item: 'Abertura das inscrições e submissões' },
  { data: '16/11', item: 'Fim das inscrições e submissões (pode ser prorrogado até 18/11)' },
  { data: '16–25/11', item: 'Avaliação dos trabalhos pela banca' },
  { data: '26/11', item: 'Resultado: apresentação oral ou pôster' },
  { data: '02–04/12', item: 'IC-ML 2026' },
] as const;

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
    r: 'Escreva para o e-mail do evento — a correção é feita pela organização.',
  },
] as const;

/**
 * Política de privacidade (WML-38, LGPD). Controlador e prazos são PROPOSTA — a organização
 * confirma antes de 30/10 e marca `aprovada: true`. Mudou o texto? Atualize `versao`: o aceite de
 * cada participante fica em participantes.consentimento_em e vale a versão em vigor naquela data.
 */
export const privacidade = {
  versao: '2026-10-19',
  /** false = a página mostra o aviso de minuta. */
  aprovada: false,
  controlador:
    'O IEEE Ramo Estudantil UFAL, que organiza o IC-ML 2026 junto com o IEEE Computer Society UFAL e o Instituto de Computação da UFAL, decide como seus dados são usados.',
  dados: [
    {
      dado: 'Nome completo, CPF e e-mail',
      motivo: 'identificar sua inscrição, enviar o comprovante e emitir o certificado',
    },
    { dado: 'Instituição (opcional)', motivo: 'conhecer o público do evento' },
    {
      dado: 'Vínculo, curso (opcional) e perfil no LinkedIn ou Lattes (opcional)',
      motivo: 'montar o seu crachá; o perfil vira um QR Code impresso nele',
    },
    { dado: 'Inscrição no minicurso', motivo: 'controlar as vagas do laboratório' },
    {
      dado: 'Título, autores, resumo e PDF do trabalho, se você submeter',
      motivo: 'avaliação pela banca e montagem da programação',
    },
    { dado: 'Data e hora em que você aceitou esta política', motivo: 'comprovar o consentimento' },
  ],
  baseLegal:
    'Seu consentimento (art. 7º, I, da LGPD), dado ao marcar a caixa de aceite no formulário. Não pedimos nenhum dado além do necessário para o evento.',
  operadores: [
    {
      nome: 'Supabase',
      papel: 'guarda o banco de dados e os PDFs (servidores nos Estados Unidos)',
    },
    { nome: 'Vercel', papel: 'hospeda o site' },
    { nome: 'Cloudflare Turnstile', papel: 'verifica que o formulário não é preenchido por robô' },
    { nome: 'Google (Gmail)', papel: 'envia os e-mails do evento' },
    { nome: 'Brevo', papel: 'envia os e-mails se o Gmail falhar' },
  ],
  compartilhamento:
    'Esses serviços só tratam os dados para executar a tarefa deles, e alguns ficam fora do Brasil (transferência internacional, art. 33 da LGPD). Não vendemos nem cedemos seus dados a ninguém. Nome e trabalho aprovado aparecem na programação do evento.',
  retencao: [
    { dados: 'PDFs dos trabalhos', ate: '2027-01-31' },
    { dados: 'CPF, e-mail, instituição, curso e perfil (LinkedIn/Lattes)', ate: '2027-03-31' },
    {
      dados: 'Nome, nº de inscrição e carga horária do certificado',
      ate: '2031-12-31',
      motivo: 'para que qualquer pessoa possa validar a autenticidade do certificado',
    },
  ],
  retencaoObs:
    'Cópias de segurança são criptografadas e apagadas automaticamente em até 14 dias. Se você cancelar a inscrição, seus dados são apagados no mesmo prazo acima, ou antes, se pedir.',
  seguranca: [
    'Só a organização acessa os dados, com login individual.',
    'O CPF aparece mascarado (ex.: ***.456.789-**) nas telas e planilhas da organização.',
    'Os PDFs ficam em área privada, sem link público.',
    'Toda conexão com o site é criptografada (HTTPS).',
    'Nenhum dado pessoal vai para registros (logs) do sistema.',
  ],
  direitos: [
    'Confirmar se tratamos seus dados e ter acesso a eles.',
    'Pedir a correção de dados incompletos ou errados.',
    'Pedir a anonimização, o bloqueio ou a eliminação de dados desnecessários.',
    'Saber sobre o compartilhamento dos seus dados: com quem e para quê (veja a lista acima).',
    'Fazer a revogação do consentimento a qualquer momento. Antes do evento, isso cancela a inscrição e o certificado.',
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
