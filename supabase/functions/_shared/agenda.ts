/** Link do Google Agenda e arquivo .ics (RFC 5545) para os dias do evento. */

export type EventoAgenda = {
  uid: string;
  titulo: string;
  inicio: Date;
  fim: Date;
  local: string;
  descricao: string;
};

/** 2026-12-02T11:00:00.000Z → 20261202T110000Z */
function utc(d: Date): string {
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function escapar(texto: string): string {
  return texto
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

export function googleCalendarUrl(e: EventoAgenda): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.titulo,
    dates: `${utc(e.inicio)}/${utc(e.fim)}`,
    location: e.local,
    details: e.descricao,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function gerarIcs(eventos: EventoAgenda[], agora: Date = new Date()): string {
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//IC-ML 2026//Workshop de Machine Learning do IC//PT-BR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const e of eventos) {
    linhas.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${utc(agora)}`,
      `DTSTART:${utc(e.inicio)}`,
      `DTEND:${utc(e.fim)}`,
      `SUMMARY:${escapar(e.titulo)}`,
      `LOCATION:${escapar(e.local)}`,
      `DESCRIPTION:${escapar(e.descricao)}`,
      'END:VEVENT',
    );
  }
  linhas.push('END:VCALENDAR');
  return linhas.join('\r\n') + '\r\n';
}
