import { describe, expect, it } from 'vitest';
import {
  BOM,
  cartoesPresenca,
  deInputLocal,
  escaparCelula,
  filtrar,
  formatarDataHora,
  gerarCsv,
  mensagemDeErro,
  paginar,
  paraInputLocal,
  rotuloVinculo,
  type Inscricao,
} from './admin';

const base: Inscricao = {
  numero: 'ICML26-0001',
  nome: 'Ana Sintética',
  email: 'ana@exemplo.com',
  cpf_mascarado: '***.982.247-**',
  instituicao: 'UFAL',
  vinculo: 'estudante',
  vinculo_outro: null,
  curso: 'Ciência da Computação',
  perfil_url: 'https://www.linkedin.com/in/ana-sintetica',
  minicurso: true,
  apresenta_trabalho: true,
  titulo_trabalho: 'Redes neurais',
  status_trabalho: 'pendente',
  concorre_premio: false,
  nivel: null,
  criada_em: '2026-10-30T13:05:00Z',
  cancelada: false,
  pdf_path: 'abc.pdf',
  email_status: 'enviado',
  dias_presente: ['2026-12-02', '2026-12-04'],
  dias_minicurso: ['2026-12-02'],
};
const lista: Inscricao[] = [
  base,
  {
    ...base,
    numero: 'ICML26-0002',
    nome: 'João Conceição',
    email: 'joao@exemplo.com',
    minicurso: false,
    apresenta_trabalho: false,
    titulo_trabalho: null,
    status_trabalho: null,
    pdf_path: null,
  },
  {
    ...base,
    numero: 'ICML26-0003',
    nome: 'Bia Cancelada',
    email: 'bia@exemplo.com',
    cancelada: true,
  },
];

describe('escaparCelula (injeção de fórmula em planilha)', () => {
  it.each(['=1+1', '+5', '-2', '@SOMA(A1)', '\tx', '\rx'])('neutraliza %j', (v) => {
    expect(escaparCelula(v)).toBe(`'${v}`);
  });
  it('mantém texto comum e o CPF mascarado', () => {
    expect(escaparCelula('Ana')).toBe('Ana');
    expect(escaparCelula('***.982.247-**')).toBe('***.982.247-**');
  });
});

describe('gerarCsv', () => {
  const csv = gerarCsv([base]);
  const linhas = csv.slice(1).split('\r\n');

  it('começa com BOM (acentos certos no Excel) e usa ; como separador', () => {
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.startsWith(BOM)).toBe(true);
    expect(linhas[0]).toBe(
      'Nº de inscrição;Nome;E-mail;CPF (mascarado);Instituição;Vínculo;Curso;' +
        'Perfil (LinkedIn/Lattes);Minicurso;Apresenta trabalho;' +
        'Título do trabalho;Status do trabalho;Concorre ao prêmio;Inscrita em;Situação;' +
        'Dias presentes;Tardes no minicurso',
    );
  });

  it('traz uma linha por inscrição com data de Maceió e rótulos legíveis', () => {
    expect(linhas[1]).toBe(
      'ICML26-0001;Ana Sintética;ana@exemplo.com;***.982.247-**;UFAL;Estudante;' +
        'Ciência da Computação;https://www.linkedin.com/in/ana-sintetica;Sim;Sim;Redes neurais;' +
        'Pendente;Não;30/10/2026 10:05;Ativa;02/12, 04/12;02/12',
    );
  });

  it('presença vazia vira célula vazia', () => {
    const csv2 = gerarCsv([{ ...base, dias_presente: [], dias_minicurso: [] }]);
    expect(csv2.split(String.fromCharCode(13, 10))[1].endsWith(';Ativa;;')).toBe(true);
  });

  it('coloca entre aspas o que tem ; aspas ou quebra de linha', () => {
    expect(gerarCsv([{ ...base, nome: 'Ana; "A"' }])).toContain(';"Ana; ""A""";');
    expect(gerarCsv([{ ...base, nome: 'Ana\nB' }])).toContain(';"Ana\nB";');
  });

  it('escapa fórmulas antes de pôr entre aspas', () => {
    expect(gerarCsv([{ ...base, titulo_trabalho: '=HIPERLINK("x")' }])).toContain(
      `;"'=HIPERLINK(""x"")";`,
    );
  });

  it('escapa fórmula também no curso (campo livre do participante)', () => {
    expect(gerarCsv([{ ...base, curso: '@SOMA(1)' }])).toContain(";'@SOMA(1);");
  });

  it('vínculo "Outro" mostra o texto livre da pessoa', () => {
    const csv2 = gerarCsv([{ ...base, vinculo: 'outro', vinculo_outro: 'Servidor técnico' }]);
    expect(csv2).toContain(';UFAL;Outro: Servidor técnico;Ciência da Computação;');
  });

  it('texto do "Outro" passa pelo escape de aspas e separador', () => {
    const csv2 = gerarCsv([{ ...base, vinculo: 'outro', vinculo_outro: 'A; "B"' }]);
    expect(csv2).toContain(';UFAL;"Outro: A; ""B""";');
  });

  it('inscrição antiga sem vínculo, curso e perfil vira células vazias', () => {
    const antiga = gerarCsv([{ ...base, vinculo: null, curso: null, perfil_url: null }]);
    expect(antiga.split(String.fromCharCode(13, 10))[1]).toContain(';UFAL;;;;Sim;');
  });

  it('nunca tem CPF completo', () => {
    expect(gerarCsv(lista)).not.toMatch(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  });
});

describe('filtrar e paginar', () => {
  it('por padrão esconde as canceladas', () => {
    expect(filtrar(lista, {}).map((i) => i.numero)).toEqual(['ICML26-0001', 'ICML26-0002']);
  });
  it('busca por nome sem acento, e-mail ou número', () => {
    expect(filtrar(lista, { busca: 'conceicao' }).map((i) => i.numero)).toEqual(['ICML26-0002']);
    expect(filtrar(lista, { busca: 'ANA@' }).map((i) => i.numero)).toEqual(['ICML26-0001']);
    expect(filtrar(lista, { busca: '0002' }).map((i) => i.numero)).toEqual(['ICML26-0002']);
  });
  it('filtra por minicurso, trabalho e situação', () => {
    expect(filtrar(lista, { minicurso: 'sim' })).toHaveLength(1);
    expect(filtrar(lista, { trabalho: 'sem' }).map((i) => i.numero)).toEqual(['ICML26-0002']);
    expect(filtrar(lista, { trabalho: 'pendente' })).toHaveLength(1);
    expect(filtrar(lista, { situacao: 'canceladas' }).map((i) => i.numero)).toEqual([
      'ICML26-0003',
    ]);
    expect(filtrar(lista, { situacao: 'todas' })).toHaveLength(3);
  });
  it('pagina com total e limites', () => {
    const muitos = Array.from({ length: 45 }, (_, k) => ({ ...base, numero: `N${k}` }));
    const p = paginar(muitos, 3, 20);
    expect(p).toMatchObject({ pagina: 3, paginas: 3, total: 45 });
    expect(p.itens.map((i) => i.numero)).toEqual(['N40', 'N41', 'N42', 'N43', 'N44']);
    expect(paginar(muitos, 99, 20).pagina).toBe(3);
    expect(paginar([], 1, 20)).toMatchObject({ pagina: 1, paginas: 1, total: 0, itens: [] });
  });
});

describe('datas (America/Maceio, UTC−3, sem horário de verão)', () => {
  it('formata para leitura', () => {
    expect(formatarDataHora('2026-11-16T23:59:59-03:00')).toBe('16/11/2026 23:59');
  });
  it('converte de e para o campo datetime-local', () => {
    expect(paraInputLocal('2026-11-17T02:59:00Z')).toBe('2026-11-16T23:59');
    expect(deInputLocal('2026-11-18T23:59')).toBe('2026-11-18T23:59:00-03:00');
  });
});

describe('rotuloVinculo', () => {
  it('Estudante, Docente e Outro com o texto da pessoa', () => {
    expect(rotuloVinculo('estudante', null)).toBe('Estudante');
    expect(rotuloVinculo('docente', null)).toBe('Docente');
    expect(rotuloVinculo('outro', 'Servidor técnico')).toBe('Outro: Servidor técnico');
  });
  it('Outro antigo sem texto, sem vínculo e valor desconhecido', () => {
    expect(rotuloVinculo('outro', null)).toBe('Outro');
    expect(rotuloVinculo(null, null)).toBe('');
    expect(rotuloVinculo('xyz', null)).toBe('xyz');
  });
});

describe('mensagemDeErro', () => {
  it('traduz os códigos do banco', () => {
    expect(mensagemDeErro('NAO_AUTORIZADO')).toMatch(/não tem acesso/);
    expect(mensagemDeErro('VAGAS_ABAIXO_DAS_OCUPADAS')).toMatch(/ocupadas/);
    expect(mensagemDeErro('EMAIL_JA_INSCRITO')).toMatch(/e-mail/);
    expect(mensagemDeErro('VINCULO_INVALIDO')).toBe(
      'Escolha o vínculo: estudante, docente ou outro.',
    );
    expect(mensagemDeErro('VINCULO_OUTRO_INVALIDO')).toMatch(/40 caracteres/);
  });
  it('tem mensagem genérica para o resto', () => {
    expect(mensagemDeErro('XYZ')).toBe('Não foi possível concluir. Tente de novo.');
    expect(mensagemDeErro(undefined)).toBe('Não foi possível concluir. Tente de novo.');
  });
});

describe('cartões de presença (WML-56)', () => {
  it('um cartão por dia (palestras) e por tarde de minicurso, em ordem', () => {
    const cartoes = cartoesPresenca({
      dias: [
        { dia: '2026-12-02', presentes: 120 },
        { dia: '2026-12-03', presentes: 0 },
      ],
      minicursos: [
        {
          slug: 'ml-na-pratica',
          titulo: 'ML na prática',
          dia: '2026-12-02',
          inscritos: 30,
          presentes: 28,
        },
      ],
    });
    expect(cartoes).toEqual([
      ['Palestras · 02/12', '120 presentes'],
      ['Palestras · 03/12', '0 presentes'],
      ['ML na prática · 02/12', '28 de 30 inscritos'],
    ]);
  });
  it('1 presente no singular', () => {
    expect(
      cartoesPresenca({ dias: [{ dia: '2026-12-04', presentes: 1 }], minicursos: [] }),
    ).toEqual([['Palestras · 04/12', '1 presente']]);
  });
});
