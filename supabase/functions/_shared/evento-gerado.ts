// GERADO por scripts/gerar-evento-funcoes.mjs a partir de src/data/evento.ts — não edite.
// Depois de mudar o conteúdo do evento, rode: npm run gerar:evento
export const EVENTO = {
  sigla: 'IC-ML 2026',
  nome: 'Workshop de Machine Learning do IC',
  realizacao: 'IEEE Ramo Estudantil UFAL · IEEE Computer Society UFAL · Instituto de Computação',
  datasTexto: '02 a 04 de dezembro de 2026',
  local: {
    nome: 'Instituto de Computação — UFAL',
    detalhe: 'Manhãs no mini-auditório do IC · tardes no Laboratório 1',
    endereco:
      'Campus A. C. Simões · Av. Lourival Melo Mota, s/n · Tabuleiro do Martins · Maceió/AL',
    mapa: 'https://www.google.com/maps/search/?api=1&query=Instituto+de+Computa%C3%A7%C3%A3o+UFAL+Macei%C3%B3',
  },
  agenda: [
    {
      uid: 'icml2026-2026-12-02@workshop-ml-ic-ufal',
      titulo: 'IC-ML 2026 — Dia 1',
      inicio: '2026-12-02T11:00:00.000Z',
      fim: '2026-12-02T20:10:00.000Z',
      local: 'Instituto de Computação — UFAL, Maceió',
      descricao:
        '08:00 Credenciamento\n09:00 Abertura formal\n10:00 Palestra de abertura — pesquisador convidado\n12:00 Almoço\n13:30 Minicurso — aula 1',
    },
    {
      uid: 'icml2026-2026-12-03@workshop-ml-ic-ufal',
      titulo: 'IC-ML 2026 — Dia 2',
      inicio: '2026-12-03T11:00:00.000Z',
      fim: '2026-12-03T20:10:00.000Z',
      local: 'Instituto de Computação — UFAL, Maceió',
      descricao:
        '08:00 Credenciamento\n08:30 Apresentações de trabalhos (coffee break às 10h)\n12:30 Almoço\n13:30 Minicurso — aula 2',
    },
    {
      uid: 'icml2026-2026-12-04@workshop-ml-ic-ufal',
      titulo: 'IC-ML 2026 — Dia 3',
      inicio: '2026-12-04T11:00:00.000Z',
      fim: '2026-12-04T20:20:00.000Z',
      local: 'Instituto de Computação — UFAL, Maceió',
      descricao:
        '08:00 Credenciamento\n08:30 Apresentações de trabalhos\n10:30 Coffee break\n11:00 Palestra — ML e ciência de dados no mercado\n12:00 Encerramento e premiação\n13:00 Almoço\n13:40 Minicurso — aula 3',
    },
  ],
} as const;
