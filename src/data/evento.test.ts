import { describe, expect, it } from 'vitest';
import {
  apresentacoes,
  dias,
  evento,
  eventosDeAgenda,
  faq,
  janela,
  minicurso,
  palestras,
  trabalhos,
} from './evento';

// Conteúdo do evento (WML-71): regras do documento atualizado da organização.
const minutos = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

describe('programação', () => {
  it('tem três dias, de 02 a 04/12', () => {
    expect(dias.map((d) => d.data)).toEqual(['2026-12-02', '2026-12-03', '2026-12-04']);
  });

  it('cada dia é contínuo: sem buracos nem sobreposição entre atividades', () => {
    for (const d of dias) {
      d.atividades.forEach((a, i) => {
        expect(minutos(a.fim)).toBeGreaterThan(minutos(a.inicio));
        if (i > 0) expect(a.inicio).toBe(d.atividades[i - 1].fim);
      });
    }
  });

  it('credenciamento só no primeiro dia', () => {
    const credenciamento = dias.map((d) => d.atividades.some((a) => a.titulo === 'Credenciamento'));
    expect(credenciamento).toEqual([true, false, false]);
  });

  it('coffee break separado das apresentações nos dias 2 e 3', () => {
    for (const d of dias.slice(1)) {
      expect(d.atividades.some((a) => a.titulo === 'Coffee break' && a.tipo === 'pausa')).toBe(
        true,
      );
      expect(d.atividades.every((a) => !/coffee/i.test(a.titulo) || a.tipo === 'pausa')).toBe(true);
    }
  });

  it('nomeia os palestrantes confirmados', () => {
    const titulos = dias.flatMap((d) => d.atividades.filter((a) => a.tipo === 'palestra'));
    expect(titulos.map((a) => a.titulo)).toEqual([
      'Palestra de abertura — Inteligência Artificial além do alarde! Entre o apocalipse e a salvação! · Prof. George Darmiton',
      'Palestra — Além do Algoritmo: o papel da Engenharia de Dados no pré-processamento de modelos de Machine Learning · Hugo Souza',
    ]);
  });

  it('o .ics de cada dia começa às 08:00', () => {
    for (const e of eventosDeAgenda()) {
      expect(e.inicio.toISOString().slice(11, 16)).toBe('11:00');
    }
  });
});

describe('minicurso', () => {
  it('tem 3 dias, um por tarde da programação', () => {
    const tardes = dias.flatMap((d) => d.atividades.filter((a) => a.tipo === 'minicurso'));
    expect(minicurso.dias).toHaveLength(3);
    expect(tardes).toHaveLength(minicurso.dias.length);
    minicurso.dias.forEach((m, i) => {
      expect(tardes[i].titulo).toBe(`Minicurso — Dia ${i + 1}: ${m.titulo}`);
    });
  });

  it('48 vagas: a capacidade do Laboratório 1', () => {
    expect(minicurso.vagas).toBe(48);
  });

  it('o resumo não fala mais em quatro blocos', () => {
    expect(minicurso.resumo).not.toMatch(/blocos|instrutor/i);
  });

  it('o hero conta 3 tardes de minicurso e as 11 apresentações da programação (WML-81)', () => {
    expect(evento.hero.numeros).toEqual([
      { valor: '03', rotulo: 'dias' },
      { valor: '03', rotulo: 'tardes de minicurso' },
      { valor: String(apresentacoes.length), rotulo: 'apresentações' },
    ]);
    expect(apresentacoes).toHaveLength(11);
  });
});

describe('apresentações de trabalhos (WML-81)', () => {
  it('7 no Dia 2 e 4 no Dia 3, de 30 min, sem sobreposição', () => {
    expect(apresentacoes.filter((a) => a.data === '2026-12-03')).toHaveLength(7);
    expect(apresentacoes.filter((a) => a.data === '2026-12-04')).toHaveLength(4);
    apresentacoes.forEach((a, i) => {
      expect(minutos(a.fim) - minutos(a.inicio)).toBe(30);
      const anterior = apresentacoes[i - 1];
      if (anterior?.data === a.data) {
        expect(minutos(a.inicio)).toBeGreaterThanOrEqual(minutos(anterior.fim));
      }
    });
  });

  it('cada uma cai dentro de um bloco "Apresentações de trabalhos" do seu dia', () => {
    for (const a of apresentacoes) {
      const dia = dias.find((d) => d.data === a.data);
      const bloco = dia?.atividades.find(
        (b) =>
          b.tipo === 'trabalhos' &&
          minutos(b.inicio) <= minutos(a.inicio) &&
          minutos(a.fim) <= minutos(b.fim),
      );
      expect(bloco, `${a.data} ${a.inicio}`).toBeDefined();
    }
  });

  it('todo bloco de trabalhos tem ao menos uma apresentação', () => {
    for (const d of dias) {
      for (const b of d.atividades.filter((x) => x.tipo === 'trabalhos')) {
        const dentro = apresentacoes.filter(
          (a) => a.data === d.data && a.inicio >= b.inicio && a.fim <= b.fim,
        );
        expect(dentro.length, `${d.data} ${b.inicio}`).toBeGreaterThan(0);
      }
    }
  });

  it('título e quem apresenta preenchidos, sem espaço sobrando', () => {
    for (const a of apresentacoes) {
      expect(a.titulo).toBe(a.titulo.trim().replace(/\s+/g, ' '));
      expect(a.quem).toBe(a.quem.trim().replace(/\s+/g, ' '));
      expect(a.titulo.length).toBeGreaterThan(10);
      expect(a.quem.split(' ').length).toBeGreaterThan(1);
    }
  });
});

describe('inscrições', () => {
  it('estão encerradas desde 20/11 (WML-81)', () => {
    expect(janela.abertas).toBe(false);
  });
});

describe('palestras', () => {
  it('palestra de abertura traz o tema, como a do Hugo (WML-81)', () => {
    expect(palestras[0]).toMatchObject({
      rotulo: 'Palestra de abertura',
      titulo: 'Inteligência Artificial além do alarde! Entre o apocalipse e a salvação!',
      quem: 'Prof. George Darmiton',
    });
  });

  it('casam com as palestras da programação', () => {
    const daProgramacao = dias.flatMap((d) =>
      d.atividades.filter((a) => a.tipo === 'palestra').map((a) => `${d.semana} ${a.inicio}`),
    );
    expect(palestras.map((p) => `${p.dia} ${p.inicio}`)).toEqual(daProgramacao);
  });
});

describe('submissão de trabalhos', () => {
  it('pede só título, autores e resumo, sem artigo nem modelo da SBC (WML-75)', () => {
    expect(trabalhos.formato).toMatch(/título, autores e um resumo/i);
    expect(JSON.stringify(trabalhos)).not.toMatch(/SBC|premia|\.zip/i);
  });

  it('informa 13 vagas para apresentação, sem dizer que a banca escolhe', () => {
    expect(trabalhos.vagasApresentacao).toBe(13);
    expect(trabalhos.vagasTexto).toContain('13 vagas para apresentação');
    expect(trabalhos.vagasTexto).not.toMatch(/banca/i);
  });
});

describe('janela de inscrição', () => {
  it('textos do site acompanham o fim da janela (prorrogada até 20/11)', () => {
    expect(janela.fim).toBe('2026-11-20T23:59:59-03:00');
    expect(janela.textoCurto).toBe('30.10 → 20.11');
    expect(janela.textoPeriodo).toContain('20/11');
    expect(janela.textoLeitor).toContain('20 de novembro');
    expect(trabalhos.prazo).toContain('20/11/2026');
    expect(JSON.stringify({ janela, trabalhos })).not.toMatch(/16\/11|16\.11|18\/11/);
  });
});

describe('contato', () => {
  it('é o e-mail institucional do evento', () => {
    expect(evento.contato).toBe('ic-ml@ic.ufal.br');
  });

  it('a FAQ "Errei meus dados" cita o e-mail', () => {
    const errei = faq.find((f) => f.p.startsWith('Errei meus dados'));
    expect(errei?.r).toContain(evento.contato);
  });
});
