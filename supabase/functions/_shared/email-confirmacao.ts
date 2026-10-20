// E-mail de confirmação de inscrição (WML-31): texto + HTML simples, comprovante PDF (WML-30),
// arquivo .ics com os 3 dias e um link do Google Agenda por dia.
// Tudo que vem do participante é escapado no HTML; CPF só mascarado (CLAUDE.md, regra 2).
import { gerarIcs, googleCalendarUrl, type EventoAgenda } from './agenda.ts';
import { gerarComprovante } from './comprovante.ts';
import { EVENTO } from './evento-gerado.ts';
import { assinarInscricao } from './qr.ts';

export type DadosConfirmacao = {
  numero: string;
  nome: string;
  email: string;
  cpfMascarado: string;
  minicurso: string | null;
  trabalho: string | null;
};

export type Anexo = { nome: string; conteudo: Uint8Array; tipo: string };

export type Mensagem = {
  para: string;
  assunto: string;
  texto: string;
  html: string;
  anexos: Anexo[];
  /** Token assinado impresso no QR do comprovante (só no e-mail de confirmação). */
  qr?: string;
};

// Cores de marca (src/styles/global.css: fundo-1 e acao-2). E-mail não lê variáveis CSS.
const AZUL = '#071a45';
const LARANJA = '#e87722';

export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function diasDoEvento(): EventoAgenda[] {
  return EVENTO.agenda.map((e) => ({ ...e, inicio: new Date(e.inicio), fim: new Date(e.fim) }));
}

export async function montarEmailConfirmacao(
  d: DadosConfirmacao,
  opcoes: { segredoQr: string; agora?: Date; siteUrl?: string },
): Promise<Mensagem> {
  const agora = opcoes.agora ?? new Date();
  const primeiroNome = d.nome.trim().split(/\s+/)[0];
  const qr = await assinarInscricao(d.numero, opcoes.segredoQr);
  const dias = diasDoEvento();
  const links = dias.map((e) => ({ titulo: e.titulo, url: googleCalendarUrl(e) }));

  const detalhes: [string, string][] = [
    ['Número de inscrição', d.numero],
    ['CPF', d.cpfMascarado],
    ['Palestras e apresentações', 'todos os dias do evento'],
  ];
  if (d.minicurso) detalhes.push(['Minicurso', d.minicurso]);
  if (d.trabalho) detalhes.push(['Trabalho submetido', d.trabalho]);

  const texto = [
    `Olá, ${primeiroNome}!`,
    '',
    `Sua inscrição no ${EVENTO.sigla} — ${EVENTO.nome} está confirmada.`,
    '',
    ...detalhes.map(([rotulo, valor]) => `${rotulo}: ${valor}`),
    '',
    `Quando: ${EVENTO.datasTexto}`,
    `Onde: ${EVENTO.local.nome} (${EVENTO.local.endereco})`,
    '',
    'O comprovante em PDF está anexado. Leve o QR Code dele (no celular ou impresso) para o credenciamento.',
    '',
    'Para adicionar o evento à sua agenda, abra o arquivo .ics anexado ou use os links do Google Agenda:',
    ...links.map((l) => `- ${l.titulo}: ${l.url}`),
    ...(opcoes.siteUrl ? ['', `Programação completa: ${opcoes.siteUrl}`] : []),
    '',
    'Se esta mensagem foi para o spam ou lixo eletrônico, marque como "não é spam" para receber os próximos avisos do evento (como o certificado).',
    '',
    'Se você não fez esta inscrição, ignore esta mensagem.',
    '',
    `${EVENTO.sigla} · ${EVENTO.realizacao}`,
  ].join('\n');

  const linha = ([rotulo, valor]: [string, string]) =>
    `<tr><td style="padding:4px 12px 4px 0;color:#555">${escaparHtml(rotulo)}</td>` +
    `<td style="padding:4px 0"><strong>${escaparHtml(valor)}</strong></td></tr>`;
  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.5">
<div style="max-width:560px;margin:0 auto">
<p style="margin:0 0 4px;color:${LARANJA};font-weight:bold;letter-spacing:.05em">${escaparHtml(EVENTO.sigla)}</p>
<h1 style="margin:0 0 16px;font-size:22px;color:${AZUL}">Inscrição confirmada</h1>
<p>Olá, ${escaparHtml(primeiroNome)}!</p>
<p>Sua inscrição no <strong>${escaparHtml(EVENTO.sigla)} — ${escaparHtml(EVENTO.nome)}</strong> está confirmada.</p>
<table role="presentation" style="border-collapse:collapse;margin:16px 0">${detalhes.map(linha).join('')}</table>
<p><strong>Quando:</strong> ${escaparHtml(EVENTO.datasTexto)}<br>
<strong>Onde:</strong> ${escaparHtml(EVENTO.local.nome)} — ${escaparHtml(EVENTO.local.endereco)}</p>
<p>O <strong>comprovante em PDF</strong> está anexado. Leve o QR Code dele (no celular ou impresso) para o credenciamento.</p>
<p>Adicione à sua agenda (ou abra o arquivo <code>.ics</code> anexado):</p>
<ul>${links.map((l) => `<li><a href="${escaparHtml(l.url)}" style="color:${AZUL}">${escaparHtml(l.titulo)} — Google Agenda</a></li>`).join('')}</ul>
${opcoes.siteUrl ? `<p>Programação completa: <a href="${escaparHtml(opcoes.siteUrl)}" style="color:${AZUL}">${escaparHtml(opcoes.siteUrl)}</a></p>` : ''}
<p style="color:#555;font-size:13px">Se esta mensagem foi para o spam ou lixo eletrônico, marque como &quot;não é spam&quot; para receber os próximos avisos do evento (como o certificado).</p>
<p style="color:#555;font-size:13px">Se você não fez esta inscrição, ignore esta mensagem.</p>
<p style="color:#555;font-size:13px">${escaparHtml(EVENTO.sigla)} · ${escaparHtml(EVENTO.realizacao)}</p>
</div></body></html>`;

  const pdf = await gerarComprovante({
    numero: d.numero,
    nome: d.nome,
    cpfMascarado: d.cpfMascarado,
    email: d.email,
    minicurso: d.minicurso,
    trabalho: d.trabalho,
    qr,
    emitidoEm: agora,
  });

  return {
    para: d.email,
    assunto: `${EVENTO.sigla} · Inscrição confirmada · ${d.numero}`,
    texto,
    html,
    qr,
    anexos: [
      { nome: `comprovante-${d.numero}.pdf`, conteudo: pdf, tipo: 'application/pdf' },
      {
        nome: 'ic-ml-2026.ics',
        conteudo: new TextEncoder().encode(gerarIcs(dias, agora)),
        tipo: 'text/calendar; charset=utf-8; method=PUBLISH',
      },
    ],
  };
}
