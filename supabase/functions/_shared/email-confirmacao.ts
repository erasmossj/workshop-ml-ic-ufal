// E-mail de confirmação de inscrição (WML-31): texto + HTML simples, comprovante PDF (WML-30),
// arquivo .ics com os 3 dias e um link do Google Agenda por dia.
// Tudo que vem do participante é escapado no HTML; CPF só mascarado (CLAUDE.md, regra 2).
import { gerarIcs, googleCalendarUrl, type EventoAgenda } from './agenda.ts';
import { gerarComprovante } from './comprovante.ts';
import { EVENTO } from './evento-gerado.ts';
import { COR } from './marca.ts';
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

export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Identidade final (Figma "IC-ML", WML-68), modo Light. E-mail não lê variáveis CSS nem SVG:
// cores de marca.ts (iguais ao .modo-claro do site) e logos em PNG servidos pelo próprio site.
const TEXTO = "'DM Sans',Arial,Helvetica,sans-serif";
const MONO = "'IBM Plex Mono','Courier New',monospace";
export const ESTILO = {
  link: `color:${COR.blueInk}`,
  rotulo: `padding:6px 16px 6px 0;font:500 11px/16px ${MONO};letter-spacing:.08em;text-transform:uppercase;color:${COR.ink300};vertical-align:top`,
  valor: `padding:6px 0;font-weight:600;color:${COR.ink100}`,
  nota: `color:${COR.ink300};font-size:13px`,
  mono: `font-family:${MONO}`,
} as const;

/** Molde comum dos e-mails: topo com logo IC-ML, rótulo de sistema, título e logo conjunto. */
export function moldeEmail(o: {
  etiqueta: string;
  titulo: string;
  /** HTML já escapado. */
  corpo: string;
  siteUrl?: string;
}): string {
  const site = o.siteUrl ? escaparHtml(o.siteUrl.replace(/\/$/, '')) : null;
  const logo = site
    ? `<img src="${site}/marca/logo-icml-claro.png" width="155" height="30" alt="${escaparHtml(EVENTO.sigla)}" style="display:block;border:0">`
    : `<p style="margin:0;font:600 20px/30px ${MONO};color:${COR.ink100}">${escaparHtml(EVENTO.sigla)}</p>`;
  const conjunto = site
    ? `<img src="${site}/marca/logo-conjunto-preto.png" width="187" height="34" alt="IEEE, IEEE Computer Society — Ramo Estudantil IEEE da UFAL — e Instituto de Computação da UFAL" style="display:block;border:0;margin:0 0 12px">`
    : '';
  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px 12px;background:${COR.bg000};font-family:${TEXTO};font-size:15px;color:${COR.ink100};line-height:1.5">
<div style="max-width:560px;margin:0 auto;background:${COR.bg200};border:1px solid ${COR.line100};border-radius:6px;overflow:hidden">
<div style="padding:24px 28px;background:${COR.bg000};border-bottom:3px solid ${COR.lime500}">${logo}</div>
<div style="padding:28px">
<p style="margin:0 0 8px;font:500 11px/16px ${MONO};letter-spacing:.08em;text-transform:uppercase;color:${COR.limeInk}">${escaparHtml(o.etiqueta)}</p>
<h1 style="margin:0 0 16px;font:600 24px/30px ${TEXTO};color:${COR.ink100}">${escaparHtml(o.titulo)}</h1>
${o.corpo}
</div>
<div style="padding:20px 28px;border-top:1px solid ${COR.line100};font-size:12px;line-height:18px;color:${COR.ink300}">${conjunto}${escaparHtml(EVENTO.sigla)} · ${escaparHtml(EVENTO.realizacao)}</div>
</div></body></html>`;
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
    `<tr><td style="${ESTILO.rotulo}">${escaparHtml(rotulo)}</td>` +
    `<td style="${ESTILO.valor}">${escaparHtml(valor)}</td></tr>`;
  const html = moldeEmail({
    etiqueta: `Comprovante · ${EVENTO.sigla}`,
    titulo: 'Inscrição confirmada',
    siteUrl: opcoes.siteUrl,
    corpo: `<p>Olá, ${escaparHtml(primeiroNome)}!</p>
<p>Sua inscrição no <strong>${escaparHtml(EVENTO.sigla)} — ${escaparHtml(EVENTO.nome)}</strong> está confirmada.</p>
<table role="presentation" style="border-collapse:collapse;margin:16px 0">${detalhes.map(linha).join('')}</table>
<p><strong>Quando:</strong> ${escaparHtml(EVENTO.datasTexto)}<br>
<strong>Onde:</strong> ${escaparHtml(EVENTO.local.nome)} — ${escaparHtml(EVENTO.local.endereco)}</p>
<p>O <strong>comprovante em PDF</strong> está anexado. Leve o QR Code dele (no celular ou impresso) para o credenciamento.</p>
<p>Adicione à sua agenda (ou abra o arquivo <code style="${ESTILO.mono}">.ics</code> anexado):</p>
<ul>${links.map((l) => `<li><a href="${escaparHtml(l.url)}" style="${ESTILO.link}">${escaparHtml(l.titulo)} — Google Agenda</a></li>`).join('')}</ul>
${opcoes.siteUrl ? `<p>Programação completa: <a href="${escaparHtml(opcoes.siteUrl)}" style="${ESTILO.link}">${escaparHtml(opcoes.siteUrl)}</a></p>` : ''}
<p style="${ESTILO.nota}">Se esta mensagem foi para o spam ou lixo eletrônico, marque como &quot;não é spam&quot; para receber os próximos avisos do evento (como o certificado).</p>
<p style="${ESTILO.nota}">Se você não fez esta inscrição, ignore esta mensagem.</p>`,
  });

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
