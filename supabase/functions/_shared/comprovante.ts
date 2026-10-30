// Comprovante de inscrição em PDF (WML-30), anexado ao e-mail de confirmação.
// Identidade final (WML-68): modo Light (impressos) do Figma "IC-ML" — DM Sans, IBM Plex Mono,
// logo IC-ML no topo e logo conjunto IEEE × CS × IC no rodapé (obrigatório em toda aplicação).
// CPF só mascarado (CLAUDE.md, regra 2). O QR carrega o token assinado (qr.ts), não dado pessoal.
import { PDFDocument, PDFFont, PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import { EVENTO } from './evento-gerado.ts';
import { carregarMarca, COR, rgbDe } from './marca.ts';
import { paraWinAnsi } from './winansi.ts';

export { paraWinAnsi };

export type DadosComprovante = {
  numero: string;
  nome: string;
  cpfMascarado: string;
  email: string;
  /** Título do minicurso, ou null se não se inscreveu. */
  minicurso: string | null;
  /** Título do trabalho submetido, ou null. */
  trabalho: string | null;
  /** Token assinado do QR (assinarInscricao). */
  qr: string;
  emitidoEm: Date;
};

const TINTA = rgbDe(COR.ink100);
const TINTA_SUAVE = rgbDe(COR.ink300);
const LIMA_TINTA = rgbDe(COR.limeInk);
const LIMA = rgbDe(COR.lime500);
const LINHA = rgbDe(COR.line100);
const PAPEL = rgbDe(COR.bg200);
const FUNDO = rgbDe(COR.bg000);

const LARGURA = 595.28; // A4
const ALTURA = 841.89;
const MARGEM = 56;

function quebrarLinhas(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const linhas: string[] = [];
  let atual = '';
  for (const palavra of texto.split(/\s+/)) {
    const tentativa = atual ? `${atual} ${palavra}` : palavra;
    if (atual && fonte.widthOfTextAtSize(tentativa, tamanho) > largura) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = tentativa;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

function desenharQr(pagina: PDFPage, token: string, x: number, y: number, lado: number) {
  const qr = QRCode.create(token, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const modulo = lado / (n + 8); // zona de silêncio de 4 módulos em cada lado
  pagina.drawRectangle({
    x,
    y,
    width: lado,
    height: lado,
    color: PAPEL,
    borderColor: LINHA,
    borderWidth: 1,
  });
  for (let linha = 0; linha < n; linha++) {
    for (let coluna = 0; coluna < n; coluna++) {
      if (!qr.modules.get(linha, coluna)) continue;
      pagina.drawRectangle({
        x: x + (coluna + 4) * modulo,
        y: y + lado - (linha + 5) * modulo,
        width: modulo,
        height: modulo,
        color: TINTA,
      });
    }
  }
}

const formatoData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Maceio',
  dateStyle: 'short',
  timeStyle: 'short',
});

export async function gerarComprovante(d: DadosComprovante): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const titulo = `Comprovante de inscrição — ${d.numero}`;
  pdf.setTitle(titulo);
  pdf.setAuthor(EVENTO.sigla);
  pdf.setSubject(`${EVENTO.sigla} — ${EVENTO.nome}`);
  pdf.setCreationDate(d.emitidoEm);

  const pagina = pdf.addPage([LARGURA, ALTURA]);
  const m = await carregarMarca(pdf);
  const suportados = new Set(m.texto.getCharacterSet());
  const t = (texto: string) => paraWinAnsi(texto, suportados);
  const tm = (texto: string) => paraWinAnsi(texto, new Set(m.mono.getCharacterSet()));

  // Topo: faixa off-white (bg-000) com o logo IC-ML e o rótulo de sistema; fio lima de corte seco.
  pagina.drawRectangle({ x: 0, y: ALTURA - 110, width: LARGURA, height: 110, color: FUNDO });
  pagina.drawRectangle({ x: 0, y: ALTURA - 113, width: LARGURA, height: 3, color: LIMA });
  if (m.logoIcml) {
    const altura = 30;
    const largura = (m.logoIcml.width / m.logoIcml.height) * altura;
    pagina.drawImage(m.logoIcml, { x: MARGEM, y: ALTURA - 70, width: largura, height: altura });
  } else {
    pagina.drawText(t(EVENTO.sigla), {
      x: MARGEM,
      y: ALTURA - 64,
      size: 26,
      font: m.textoForte,
      color: TINTA,
    });
  }
  const rotuloTopo = tm('COMPROVANTE DE INSCRIÇÃO');
  pagina.drawText(rotuloTopo, {
    x: LARGURA - MARGEM - m.monoMedio.widthOfTextAtSize(rotuloTopo, 8),
    y: ALTURA - 60,
    size: 8,
    font: m.monoMedio,
    color: TINTA_SUAVE,
  });

  let y = ALTURA - 170;
  pagina.drawText(t('Comprovante de inscrição'), {
    x: MARGEM,
    y,
    size: 22,
    font: m.textoForte,
    color: TINTA,
  });
  y -= 22;
  pagina.drawText(t(`${EVENTO.nome} · ${EVENTO.datasTexto}`), {
    x: MARGEM,
    y,
    size: 11,
    font: m.texto,
    color: TINTA_SUAVE,
  });

  // QR à direita
  const ladoQr = 150;
  desenharQr(pagina, d.qr, LARGURA - MARGEM - ladoQr, y - 30 - ladoQr, ladoQr);
  const legenda = tm('APRESENTE NO CREDENCIAMENTO');
  pagina.drawText(legenda, {
    x: LARGURA - MARGEM - ladoQr / 2 - m.monoMedio.widthOfTextAtSize(legenda, 7) / 2,
    y: y - 44 - ladoQr,
    size: 7,
    font: m.monoMedio,
    color: TINTA_SUAVE,
  });

  const larguraCampos = LARGURA - 2 * MARGEM - ladoQr - 24;
  const campos: [string, string][] = [
    ['Número de inscrição', d.numero],
    ['Nome', d.nome],
    ['CPF', d.cpfMascarado],
    ['E-mail', d.email],
    ['Palestras e apresentações', 'Todos os dias do evento'],
    ['Minicurso', d.minicurso ?? 'Não inscrito'],
    ['Trabalho submetido', d.trabalho ?? 'Nenhum'],
  ];
  y -= 40;
  for (const [rotulo, valor] of campos) {
    const destaque = rotulo === 'Número de inscrição';
    pagina.drawText(tm(rotulo.toUpperCase()), {
      x: MARGEM,
      y,
      size: 7.5,
      font: m.monoMedio,
      color: LIMA_TINTA,
    });
    // O número em destaque (18 pt) precisa de mais respiro abaixo do rótulo.
    y -= destaque ? 22 : 15;
    const fonte = destaque ? m.monoMedio : m.texto;
    const tamanho = destaque ? 18 : 12;
    for (const linha of quebrarLinhas(
      destaque ? tm(valor) : t(valor),
      fonte,
      tamanho,
      larguraCampos,
    )) {
      pagina.drawText(linha, { x: MARGEM, y, size: tamanho, font: fonte, color: TINTA });
      y -= destaque ? 22 : 16;
    }
    y -= 10;
  }

  // Evento
  y -= 10;
  pagina.drawLine({
    start: { x: MARGEM, y },
    end: { x: LARGURA - MARGEM, y },
    thickness: 1,
    color: LINHA,
  });
  y -= 24;
  pagina.drawText(tm('QUANDO E ONDE'), {
    x: MARGEM,
    y,
    size: 7.5,
    font: m.monoMedio,
    color: LIMA_TINTA,
  });
  y -= 16;
  for (const linha of [
    EVENTO.datasTexto,
    EVENTO.local.nome,
    EVENTO.local.detalhe,
    EVENTO.local.endereco,
  ]) {
    for (const parte of quebrarLinhas(t(linha), m.texto, 11, LARGURA - 2 * MARGEM)) {
      pagina.drawText(parte, { x: MARGEM, y, size: 11, font: m.texto, color: TINTA });
      y -= 15;
    }
  }

  // Rodapé: fio, logo conjunto (≥ 8 mm de altura) e emissão.
  pagina.drawLine({
    start: { x: MARGEM, y: 112 },
    end: { x: LARGURA - MARGEM, y: 112 },
    thickness: 1,
    color: LINHA,
  });
  if (m.logoConjunto) {
    const altura = 28;
    const largura = (m.logoConjunto.width / m.logoConjunto.height) * altura;
    pagina.drawImage(m.logoConjunto, { x: MARGEM, y: 66, width: largura, height: altura });
  }
  const rodape = [
    `Emitido em ${formatoData.format(d.emitidoEm)} (horário de Maceió).`,
    `Realização: ${EVENTO.realizacao}.`,
  ];
  let yRodape = 46;
  for (const linha of rodape) {
    for (const parte of quebrarLinhas(tm(linha), m.mono, 7, LARGURA - 2 * MARGEM)) {
      pagina.drawText(parte, { x: MARGEM, y: yRodape, size: 7, font: m.mono, color: TINTA_SUAVE });
      yRodape -= 10;
    }
  }

  return pdf.save();
}
