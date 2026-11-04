import { describe, expect, it } from 'vitest';
import { dias, evento, eventosDeAgenda, faq, minicurso, palestras, trabalhos } from './evento';

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
      'Palestra de abertura — Prof. George Darmiton',
      'Palestra — Mercado de trabalho em ML · Hugo Souza',
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

  it('o hero conta 3 tardes de minicurso e 13 apresentações', () => {
    expect(evento.hero.numeros).toEqual([
      { valor: '03', rotulo: 'dias' },
      { valor: '03', rotulo: 'tardes de minicurso' },
      { valor: '13', rotulo: 'apresentações' },
    ]);
  });
});

describe('palestras', () => {
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

describe('contato', () => {
  it('é o e-mail institucional do evento', () => {
    expect(evento.contato).toBe('ic-ml@ic.ufal.br');
  });

  it('a FAQ "Errei meus dados" cita o e-mail', () => {
    const errei = faq.find((f) => f.p.startsWith('Errei meus dados'));
    expect(errei?.r).toContain(evento.contato);
  });
});
