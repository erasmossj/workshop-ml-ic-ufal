// E-mail de confirmação de inscrição (WML-31; visual WML-74): texto + HTML, comprovante PDF (WML-30),
// arquivo .ics com os 3 dias e um link do Google Agenda por dia.
// Tudo que vem do participante é escapado no HTML; CPF só mascarado (CLAUDE.md, regra 2).
import { gerarIcs, googleCalendarUrl, type EventoAgenda } from './agenda.ts';
import { datasEmDestaque, gerarComprovante } from './comprovante.ts';
import { EVENTO } from './evento-gerado.ts';
import { COR, FONTE_EMAIL, RAIO } from './marca.ts';
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

// Identidade IC-ML (Figma, WML-68/WML-74), modo Light. Não há frame de e-mail no Figma: o molde é
// composto do Cartaz A5 (Aplicações, node 61:1662: faixa halftone, rótulo de sistema, título display,
// data em numerais, Tags, BoundingBox, rodapé com logos) e dos componentes Panel e Button.
// E-mail não lê variáveis CSS, SVG nem fontes do site: cores/raios/fontes vêm de marca.ts (iguais ao
// .modo-claro do site), fontes caem para as do sistema e as imagens são PNGs servidos pelo site.
// Layout em tabelas com CSS inline (Gmail, Outlook), largura máxima de 600 px.
const F = FONTE_EMAIL;
const rotuloBase = `font-family:${F.mono};font-size:11px;line-height:16px;font-weight:500;letter-spacing:.08em;text-transform:uppercase`;
export const ESTILO = {
  link: `color:${COR.blueInk};text-decoration:underline`,
  rotulo: `padding:0 0 2px;${rotuloBase};color:${COR.ink300}`,
  valor: `padding:0 0 14px;font-family:${F.texto};font-size:15px;line-height:22px;font-weight:600;color:${COR.ink100}`,
  nota: `margin:0 0 8px;font-size:13px;line-height:20px;color:${COR.ink300}`,
  mono: `font-family:${F.mono}`,
} as const;

const TABELA = 'role="presentation" cellpadding="0" cellspacing="0" border="0"';

/** Tag do Figma (pílula com ponto). Palestra=Lima, Minicurso=Azul, Trabalhos=Contorno. */
export function tagEmail(texto: string, tipo: 'lima' | 'azul' | 'contorno'): string {
  const cores = {
    lima: `background:${COR.lime900};color:${COR.limeInk};border:1px solid ${COR.lime900}`,
    azul: `background:${COR.blue900};color:${COR.blueInk};border:1px solid ${COR.blue900}`,
    contorno: `background:${COR.bg200};color:${COR.ink200};border:1px solid ${COR.line200}`,
  }[tipo];
  return `<span style="display:inline-block;margin:0 6px 6px 0;padding:3px 10px;border-radius:${RAIO.pill}px;${cores};${rotuloBase};white-space:nowrap"><span aria-hidden="true" style="font-size:8px;vertical-align:1px">&#9679;</span>&nbsp;${escaparHtml(texto)}</span>`;
}

/** Button do Figma: Primary (lima, uma vez por e-mail) ou Secondary (contorno). */
export function botaoEmail(href: string, rotulo: string, tipo: 'primario' | 'secundario'): string {
  const cores =
    tipo === 'primario'
      ? `background:${COR.lime500};color:${COR.onLime};border:1px solid ${COR.lime500}`
      : `background:${COR.bg200};color:${COR.ink100};border:1px solid ${COR.line200}`;
  return `<a href="${escaparHtml(href)}" style="display:inline-block;padding:12px 14px;border-radius:${RAIO.r1}px;${cores};${rotuloBase};letter-spacing:.06em;text-decoration:none">${escaparHtml(rotulo)}</a>`;
}

/** Panel do Figma: card branco (bg-200, line-100, radius-2) com cabeçalho de sistema e LED lima. */
export function painelEmail(rotulo: string, corpo: string): string {
  return `<table ${TABELA} width="100%" style="width:100%;margin:0 0 24px;border:1px solid ${COR.line100};border-radius:${RAIO.r2}px;border-collapse:separate;background:${COR.bg200}">
<tr><td style="padding:12px 20px;border-bottom:1px solid ${COR.line100};${rotuloBase};color:${COR.ink100}"><span aria-hidden="true" style="display:inline-block;width:6px;height:6px;margin:0 8px 1px 0;background:${COR.lime500};vertical-align:middle"></span>${escaparHtml(rotulo)}</td></tr>
<tr><td style="padding:20px">${corpo}</td></tr>
</table>`;
}

/** Molde comum dos e-mails: faixa halftone, selo + rótulo de sistema, título display e rodapé com logos. */
export function moldeEmail(o: {
  etiqueta: string;
  titulo: string;
  /** HTML já escapado. */
  corpo: string;
  siteUrl?: string;
  /** Texto de pré-visualização da caixa de entrada (não aparece no corpo). */
  preheader?: string;
}): string {
  const site = o.siteUrl ? escaparHtml(o.siteUrl.replace(/\/$/, '')) : null;
  const img = (arquivo: string, l: number, a: number, alt: string, extra = '') =>
    `<img src="${site}/marca/${arquivo}" width="${l}" height="${a}" alt="${alt}" style="display:block;border:0;outline:none;text-decoration:none;${extra}">`;
  const faixa = site
    ? `<tr><td style="background:${COR.bg000};border-bottom:1px solid ${COR.line100};font-size:0;line-height:0">${img('textura-faixa-claro.png', 600, 139, '', 'width:100%;max-width:600px;height:auto')}</td></tr>`
    : `<tr><td style="height:4px;background:${COR.lime500};font-size:0;line-height:0">&nbsp;</td></tr>`;
  const logo = site
    ? img('logo-icml-claro.png', 124, 24, escaparHtml(EVENTO.sigla))
    : `<p style="margin:0;font-family:${F.display};font-size:22px;line-height:24px;font-weight:600;color:${COR.ink100}">${escaparHtml(EVENTO.sigla)}</p>`;
  const conjunto = site
    ? `<tr><td style="padding:24px 0 0">${img('logo-conjunto-preto.png', 187, 34, 'IEEE, IEEE Computer Society — Ramo Estudantil IEEE da UFAL — e Instituto de Computação da UFAL')}</td></tr>`
    : '';
  const preheader = o.preheader
    ? `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all" aria-hidden="true">${escaparHtml(o.preheader)}</div>`
    : '';
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${escaparHtml(o.titulo)}</title>
<style>@media (max-width:520px){.pad{padding-left:20px!important;padding-right:20px!important}.col{display:block!important;width:100%!important;padding-right:0!important}.display{font-size:30px!important;line-height:32px!important}}</style></head>
<body style="margin:0;padding:0;background:${COR.bg000};font-family:${F.texto};font-size:15px;line-height:24px;color:${COR.ink100};-webkit-text-size-adjust:100%">${preheader}
<table ${TABELA} width="100%" style="width:100%;background:${COR.bg000}"><tr><td align="center" style="padding:24px 12px">
<table ${TABELA} width="600" style="width:100%;max-width:600px;background:${COR.bg000};border:1px solid ${COR.line100};border-radius:${RAIO.r2}px;border-collapse:separate;overflow:hidden">
${faixa}
<tr><td class="pad" style="padding:32px 40px 0">
<table ${TABELA}><tr><td aria-hidden="true" width="24" height="24" style="width:24px;height:24px;background:${COR.lime500};border-radius:${RAIO.r1}px;text-align:center;vertical-align:middle;font-family:${F.texto};font-size:15px;line-height:24px;font-weight:700;color:${COR.onLime}">&#10003;</td>
<td style="padding-left:12px;${rotuloBase};font-size:12px;color:${COR.limeInk}">${escaparHtml(o.etiqueta)}</td></tr></table>
<h1 class="display" style="margin:20px 0 0;font-family:${F.display};font-size:36px;line-height:38px;font-weight:600;letter-spacing:-.01em;color:${COR.ink100}">${escaparHtml(o.titulo)}</h1>
</td></tr>
<tr><td class="pad" style="padding:24px 40px 8px">${o.corpo}</td></tr>
<tr><td class="pad" style="padding:0 40px 32px">
<table ${TABELA} width="100%" style="width:100%;border-top:1px solid ${COR.line100}">
<tr><td style="padding:24px 0 0">${logo}</td></tr>
${conjunto}
<tr><td style="padding:16px 0 0;font-family:${F.mono};font-size:11px;line-height:16px;color:${COR.ink300}">${escaparHtml(EVENTO.sigla)} · ${escaparHtml(EVENTO.realizacao)}</td></tr>
</table>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
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

  const { dias: diasDestaque, mesAno } = datasEmDestaque();
  const rotulo = (texto: string, cor: string) =>
    `<p style="margin:0 0 4px;${rotuloBase};color:${cor}">${escaparHtml(texto)}</p>`;
  const linha = ([r, valor]: [string, string]) =>
    `<tr><td style="${ESTILO.rotulo}">${escaparHtml(r)}</td></tr>` +
    `<tr><td style="${ESTILO.valor}">${escaparHtml(valor)}</td></tr>`;
  // Número em BoundingBox (Cartaz A5): etiqueta lima + caixa com contorno lima.
  const caixaNumero = `${rotulo('Número de inscrição', COR.ink200)}
<table ${TABELA} style="margin:0 0 20px"><tr><td style="padding:1px 6px;background:${COR.lime500};font-family:${F.mono};font-size:12px;line-height:18px;color:${COR.onLime}"><strong>inscrição</strong> confirmada</td></tr>
<tr><td style="padding:8px 14px;border:2px solid ${COR.lime500};font-family:${F.numeral};font-size:30px;line-height:34px;font-weight:800;letter-spacing:.02em;color:${COR.ink100};word-break:break-all">${escaparHtml(d.numero)}</td></tr></table>`;
  const tags = [
    tagEmail('Palestras', 'lima'),
    d.minicurso ? tagEmail('Minicurso', 'azul') : '',
    d.trabalho ? tagEmail('Trabalhos', 'contorno') : '',
  ].join('');
  // O número já está na BoundingBox; o painel lista o restante.
  const demais = detalhes.filter(([r]) => r !== 'Número de inscrição');
  const html = moldeEmail({
    etiqueta: `Comprovante · ${EVENTO.sigla}`,
    titulo: 'Inscrição confirmada.',
    siteUrl: opcoes.siteUrl,
    preheader: `Inscrição ${d.numero} confirmada. O comprovante com o QR Code do credenciamento está anexado.`,
    corpo: `<p style="margin:0 0 8px;font-size:16px">Olá, ${escaparHtml(primeiroNome)}!</p>
<p style="margin:0 0 24px;color:${COR.ink200}">Sua inscrição no <strong style="color:${COR.ink100}">${escaparHtml(EVENTO.sigla)} — ${escaparHtml(EVENTO.nome)}</strong> está confirmada.</p>
<table ${TABELA} style="margin:0 0 12px"><tr><td style="padding:0 12px 0 0;font-family:${F.numeral};font-size:34px;line-height:36px;font-weight:800;color:${COR.ink100};white-space:nowrap">${escaparHtml(diasDestaque)}</td>
<td style="vertical-align:bottom;padding:0 0 4px;${rotuloBase};font-size:12px;color:${COR.ink200}">${escaparHtml(mesAno)}</td></tr></table>
<p style="margin:0 0 18px">${tags}</p>
${painelEmail('Dados da inscrição', `${caixaNumero}<table ${TABELA} width="100%" style="width:100%">${demais.map(linha).join('')}</table>`)}
<table ${TABELA} width="100%" style="width:100%;margin:0 0 8px"><tr>
<td class="col" width="50%" valign="top" style="width:50%;padding:0 16px 16px 0">${rotulo('Quando', COR.limeInk)}<p style="margin:0">${escaparHtml(EVENTO.datasTexto)}</p></td>
<td class="col" width="50%" valign="top" style="width:50%;padding:0 0 16px">${rotulo('Onde', COR.limeInk)}<p style="margin:0">${escaparHtml(EVENTO.local.nome)}<br><span style="color:${COR.ink200}">${escaparHtml(EVENTO.local.endereco)}</span></p></td>
</tr></table>
<p style="margin:0 0 24px">O <strong>comprovante em PDF</strong> está anexado. Leve o QR Code dele (no celular ou impresso) para o credenciamento.</p>
${rotulo('Adicione à sua agenda', COR.limeInk)}
<p style="margin:0 0 12px;color:${COR.ink200}">Use os links do Google Agenda ou abra o arquivo <code style="${ESTILO.mono}">.ics</code> anexado.</p>
<table ${TABELA} style="margin:0 0 24px">${links.map((l) => `<tr><td style="padding:0 0 8px">${botaoEmail(l.url, `${l.titulo} · Google Agenda`, 'secundario')}</td></tr>`).join('')}</table>
${opcoes.siteUrl ? `<p style="margin:0 0 28px">${botaoEmail(opcoes.siteUrl, 'Ver programação →', 'primario')}</p>` : ''}
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
