// Comprovante de inscrição em PDF (WML-30), anexado ao e-mail de confirmação.
// Usa as fontes padrão do PDF (Helvetica, WinAnsi): nada para embutir, arquivo pequeno.
// CPF só mascarado (CLAUDE.md, regra 2). O QR carrega o token assinado (qr.ts), não dado pessoal.
import { PDFDocument, PDFFont, PDFPage, rgb, StandardFonts } from 'pdf-lib';
import QRCode from 'qrcode';
import { EVENTO } from './evento-gerado.ts';

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

// Tokens de marca (src/styles/global.css): fundo-1, acao-2, texto suave.
const AZUL = rgb(0x07 / 255, 0x1a / 255, 0x45 / 255);
const LARANJA = rgb(0xe8 / 255, 0x77 / 255, 0x22 / 255);
const CINZA = rgb(0.35, 0.38, 0.45);
const BRANCO = rgb(1, 1, 1);

const LARGURA = 595.28; // A4
const ALTURA = 841.89;
const MARGEM = 56;

/** Troca caracteres que a fonte padrão não codifica: tira o acento ou usa "?". */
export function paraWinAnsi(texto: string, suportados: Set<number>): string {
  let saida = '';
  for (const c of texto) {
    if (suportados.has(c.codePointAt(0)!)) {
      saida += c;
      continue;
    }
    const base = c.normalize('NFD').replace(/\p{M}/gu, '');
    saida += [...base].every((b) => suportados.has(b.codePointAt(0)!)) && base ? base : '?';
  }
  return saida;
}

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
  pagina.drawRectangle({ x, y, width: lado, height: lado, color: BRANCO });
  for (let linha = 0; linha < n; linha++) {
    for (let coluna = 0; coluna < n; coluna++) {
      if (!qr.modules.get(linha, coluna)) continue;
      pagina.drawRectangle({
        x: x + (coluna + 4) * modulo,
        y: y + lado - (linha + 5) * modulo,
        width: modulo,
        height: modulo,
        color: AZUL,
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
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const suportados = new Set(normal.getCharacterSet());
  const t = (texto: string) => paraWinAnsi(texto, suportados);

  // Faixa de topo
  pagina.drawRectangle({ x: 0, y: ALTURA - 120, width: LARGURA, height: 120, color: AZUL });
  pagina.drawRectangle({ x: 0, y: ALTURA - 126, width: LARGURA, height: 6, color: LARANJA });
  pagina.drawText(t(EVENTO.sigla), {
    x: MARGEM,
    y: ALTURA - 62,
    size: 28,
    font: negrito,
    color: BRANCO,
  });
  pagina.drawText(t(EVENTO.nome), {
    x: MARGEM,
    y: ALTURA - 90,
    size: 13,
    font: normal,
    color: BRANCO,
  });

  let y = ALTURA - 180;
  pagina.drawText(t('Comprovante de inscrição'), {
    x: MARGEM,
    y,
    size: 20,
    font: negrito,
    color: AZUL,
  });
  y -= 22;
  pagina.drawText(t('Este documento confirma a inscrição abaixo no evento.'), {
    x: MARGEM,
    y,
    size: 11,
    font: normal,
    color: CINZA,
  });

  // QR à direita
  const ladoQr = 150;
  desenharQr(pagina, d.qr, LARGURA - MARGEM - ladoQr, y - 30 - ladoQr, ladoQr);
  const legenda = t('Apresente no credenciamento');
  pagina.drawText(legenda, {
    x: LARGURA - MARGEM - ladoQr / 2 - normal.widthOfTextAtSize(legenda, 9) / 2,
    y: y - 44 - ladoQr,
    size: 9,
    font: normal,
    color: CINZA,
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
    pagina.drawText(t(rotulo.toUpperCase()), {
      x: MARGEM,
      y,
      size: 8,
      font: negrito,
      color: LARANJA,
    });
    // O número em destaque (16 pt) precisa de mais respiro abaixo do rótulo.
    y -= destaque ? 21 : 15;
    for (const linha of quebrarLinhas(
      t(valor),
      destaque ? negrito : normal,
      destaque ? 16 : 12,
      larguraCampos,
    )) {
      pagina.drawText(linha, {
        x: MARGEM,
        y,
        size: destaque ? 16 : 12,
        font: destaque ? negrito : normal,
        color: AZUL,
      });
      y -= destaque ? 20 : 16;
    }
    y -= 10;
  }

  // Evento
  y -= 10;
  pagina.drawLine({
    start: { x: MARGEM, y },
    end: { x: LARGURA - MARGEM, y },
    thickness: 0.5,
    color: CINZA,
  });
  y -= 24;
  pagina.drawText(t('QUANDO E ONDE'), { x: MARGEM, y, size: 8, font: negrito, color: LARANJA });
  y -= 16;
  for (const linha of [
    EVENTO.datasTexto,
    EVENTO.local.nome,
    EVENTO.local.detalhe,
    EVENTO.local.endereco,
  ]) {
    for (const parte of quebrarLinhas(t(linha), normal, 11, LARGURA - 2 * MARGEM)) {
      pagina.drawText(parte, { x: MARGEM, y, size: 11, font: normal, color: AZUL });
      y -= 15;
    }
  }

  // Rodapé
  const rodape = [
    `Emitido em ${formatoData.format(d.emitidoEm)} (horário de Maceió).`,
    `Realização: ${EVENTO.realizacao}.`,
  ];
  let yRodape = 70;
  for (const linha of rodape) {
    for (const parte of quebrarLinhas(t(linha), normal, 8, LARGURA - 2 * MARGEM)) {
      pagina.drawText(parte, { x: MARGEM, y: yRodape, size: 8, font: normal, color: CINZA });
      yRodape -= 11;
    }
  }

  return pdf.save();
}
