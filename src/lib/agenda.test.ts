import { describe, expect, it } from 'vitest';
import { gerarIcs, googleCalendarUrl } from './agenda';

const evento = {
  uid: 'icml2026-dia1@workshop-ml-ic-ufal',
  titulo: 'IC-ML 2026 — Dia 1',
  inicio: new Date('2026-12-02T08:00:00-03:00'),
  fim: new Date('2026-12-02T17:10:00-03:00'),
  local: 'Instituto de Computação, UFAL, Maceió',
  descricao: 'Abertura; palestra; minicurso, aula 1',
};

describe('googleCalendarUrl', () => {
  it('gera link de template com datas em UTC e campos codificados', () => {
    const url = new URL(googleCalendarUrl(evento));
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe('IC-ML 2026 — Dia 1');
    expect(url.searchParams.get('dates')).toBe('20261202T110000Z/20261202T201000Z');
    expect(url.searchParams.get('location')).toBe(evento.local);
  });
});

describe('gerarIcs', () => {
  const ics = gerarIcs(
    [evento, { ...evento, uid: 'dia2', titulo: 'Dia 2' }],
    new Date('2026-10-16T12:00:00Z'),
  );

  it('usa CRLF e envolve os eventos em um VCALENDAR', () => {
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    expect(ics.split('BEGIN:VEVENT').length - 1).toBe(2);
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it('escreve datas em UTC e escapa vírgulas e ponto e vírgula', () => {
    expect(ics).toContain('DTSTART:20261202T110000Z');
    expect(ics).toContain('DTEND:20261202T201000Z');
    expect(ics).toContain('DTSTAMP:20261016T120000Z');
    expect(ics).toContain('LOCATION:Instituto de Computação\\, UFAL\\, Maceió');
    expect(ics).toContain('DESCRIPTION:Abertura\\; palestra\\; minicurso\\, aula 1');
  });
});
