// Comprovante de inscrição em PDF (WML-30), anexado ao e-mail de confirmação.
// Identidade IC-ML (WML-68/WML-74), modo Light. Não há frame de comprovante no Figma: a página é
// composta a partir do Cartaz A5 (Aplicações, node 61:1662) — faixa halftone, rótulo de sistema,
// título Pixelify, data em Doto, Tags, BoundingBox, QR em área lima, rodapé com logo IC-ML e logo
// conjunto — e dos componentes Panel (cabeçalho com LED, faixa de pontos) e da página /confirmacao.
// CPF só mascarado (CLAUDE.md, regra 2). O QR carrega o token assinado (qr.ts), não dado pessoal.
import {
  clip,
  endPath,
  LineCapStyle,
  PDFDocument,
  PDFFont,
  PDFPage,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  type RGB,
} from 'pdf-lib';
import QRCode from 'qrcode';
import { EVENTO } from './evento-gerado.ts';
import { carregarMarca, COR, RAIO, rgbDe, type Marca } from './marca.ts';
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

const C = {
  papel: rgbDe(COR.bg200),
  fundo: rgbDe(COR.bg000),
  faixa: rgbDe(COR.bg100),
  linha: rgbDe(COR.line100),
  linhaForte: rgbDe(COR.line200),
  tinta: rgbDe(COR.ink100),
  tinta2: rgbDe(COR.ink200),
  tinta3: rgbDe(COR.ink300),
  lima: rgbDe(COR.lime500),
  limaTinta: rgbDe(COR.limeInk),
  lima900: rgbDe(COR.lime900),
  sobreLima: rgbDe(COR.onLime),
  azulTinta: rgbDe(COR.blueInk),
  azul900: rgbDe(COR.blue900),
};

const LARGURA = 595.28; // A4
const ALTURA = 841.89;
const MARGEM = 40;
const UTIL = LARGURA - 2 * MARGEM;
/** Faixa halftone: largura da página na proporção do Cartaz A5, recortada no centro. */
const ALTURA_FAIXA = 112;
/** Espaçamento dos rótulos de sistema (.rotulo: tracking 0,08em). */
const TRACKING = 0.08;

const formatoData = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Maceio',
  dateStyle: 'short',
  timeStyle: 'short',
});

/** Datas do evento no formato do cartaz: "02—04" e "DEZ · 2026" (fuso de Maceió). */
export function datasEmDestaque(): { dias: string; mesAno: string } {
  const parte = (iso: string, o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Maceio', ...o }).format(new Date(iso));
  const primeiro = EVENTO.agenda[0].inicio;
  const ultimo = EVENTO.agenda[EVENTO.agenda.length - 1].inicio;
  const [d1, d2] = [primeiro, ultimo].map((iso) => parte(iso, { day: '2-digit' }));
  const mes = parte(primeiro, { month: 'short' }).replace('.', '').toUpperCase();
  return {
    dias: d1 === d2 ? d1 : `${d1}—${d2}`,
    mesAno: `${mes} · ${parte(primeiro, { year: 'numeric' })}`,
  };
}

/** Caminho SVG (y para baixo) de um retângulo com raios por canto: [sup.esq, sup.dir, inf.dir, inf.esq]. */
function caminhoArredondado(l: number, a: number, [r1, r2, r3, r4]: number[]): string {
  const k = 0.5523; // aproximação do quarto de círculo por Bézier
  return [
    `M ${r1} 0 H ${l - r2}`,
    `C ${l - r2 + r2 * k} 0 ${l} ${r2 - r2 * k} ${l} ${r2}`,
    `V ${a - r3}`,
    `C ${l} ${a - r3 + r3 * k} ${l - r3 + r3 * k} ${a} ${l - r3} ${a}`,
    `H ${r4}`,
    `C ${r4 - r4 * k} ${a} 0 ${a - r4 + r4 * k} 0 ${a - r4}`,
    `V ${r1}`,
    `C 0 ${r1 - r1 * k} ${r1 - r1 * k} 0 ${r1} 0 Z`,
  ].join(' ');
}

function quebrarLinhas(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const linhas: string[] = [];
  let atual = '';
  const cabe = (t: string) => fonte.widthOfTextAtSize(t, tamanho) <= largura;
  // Palavra maior que a linha (ex.: e-mail longo) é cortada por caractere.
  const palavras = texto.split(/\s+/).flatMap((palavra) => {
    if (cabe(palavra)) return [palavra];
    const partes: string[] = [];
    let parte = '';
    for (const c of palavra) {
      if (parte && !cabe(parte + c)) {
        partes.push(parte);
        parte = '';
      }
      parte += c;
    }
    return parte ? [...partes, parte] : partes;
  });
  for (const palavra of palavras) {
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

/** Desenha a página. `y` é sempre a distância a partir do TOPO (como no Figma). */
class Pagina {
  private conjuntos = new Map<PDFFont, Set<number>>();
  readonly p: PDFPage;
  readonly m: Marca;
  constructor(p: PDFPage, m: Marca) {
    this.p = p;
    this.m = m;
  }

  /** Texto que a fonte consegue codificar (WinAnsi nas fontes padrão; acentos preservados). */
  seguro(texto: string, fonte: PDFFont): string {
    let cs = this.conjuntos.get(fonte);
    if (!cs) this.conjuntos.set(fonte, (cs = new Set(fonte.getCharacterSet())));
    return paraWinAnsi(texto, cs);
  }

  largura(texto: string, fonte: PDFFont, tamanho: number, tracking = 0): number {
    const t = this.seguro(texto, fonte);
    return fonte.widthOfTextAtSize(t, tamanho) + tracking * tamanho * Math.max(t.length - 1, 0);
  }

  texto(texto: string, x: number, y: number, fonte: PDFFont, tamanho: number, cor: RGB) {
    this.p.drawText(this.seguro(texto, fonte), {
      x,
      y: ALTURA - y,
      size: tamanho,
      font: fonte,
      color: cor,
    });
  }

  /** Rótulo de sistema (mono, caixa alta, espaçado). Retorna a largura desenhada. */
  rotulo(texto: string, x: number, y: number, tamanho: number, cor: RGB, fonte = this.m.monoMedio) {
    let cx = x;
    for (const c of this.seguro(texto.toUpperCase(), fonte)) {
      this.p.drawText(c, { x: cx, y: ALTURA - y, size: tamanho, font: fonte, color: cor });
      cx += fonte.widthOfTextAtSize(c, tamanho) + TRACKING * tamanho;
    }
    return cx - x - TRACKING * tamanho;
  }

  larguraRotulo(texto: string, tamanho: number, fonte = this.m.monoMedio) {
    return this.largura(texto.toUpperCase(), fonte, tamanho, TRACKING);
  }

  retangulo(x: number, y: number, l: number, a: number, cor: RGB) {
    this.p.drawRectangle({ x, y: ALTURA - y - a, width: l, height: a, color: cor });
  }

  arredondado(
    x: number,
    y: number,
    l: number,
    a: number,
    raios: number[],
    o: { cor?: RGB; borda?: RGB; espessura?: number },
  ) {
    this.p.drawSvgPath(caminhoArredondado(l, a, raios), {
      x,
      y: ALTURA - y,
      color: o.cor,
      borderColor: o.borda,
      borderWidth: o.borda ? (o.espessura ?? 1) : 0,
    });
  }

  linha(x1: number, x2: number, y: number, cor: RGB, espessura = 1) {
    this.p.drawLine({
      start: { x: x1, y: ALTURA - y },
      end: { x: x2, y: ALTURA - y },
      thickness: espessura,
      color: cor,
    });
  }
}

/** QR em "área lima" (Cartaz A5): lima-500 em volta, papel branco com zona de silêncio de 4 módulos. */
function desenharQr(g: Pagina, token: string, x: number, y: number, lado: number) {
  const borda = 8;
  g.retangulo(x, y, lado, lado, C.lima);
  const interno = lado - 2 * borda;
  g.retangulo(x + borda, y + borda, interno, interno, C.papel);
  const qr = QRCode.create(token, { errorCorrectionLevel: 'M' });
  const n = qr.modules.size;
  const modulo = interno / (n + 8);
  for (let linha = 0; linha < n; linha++) {
    for (let coluna = 0; coluna < n; coluna++) {
      if (!qr.modules.get(linha, coluna)) continue;
      g.retangulo(
        x + borda + (coluna + 4) * modulo,
        y + borda + (linha + 4) * modulo,
        modulo,
        modulo,
        C.tinta,
      );
    }
  }
}

type Tag = { texto: string; fundo?: RGB; borda?: RGB; cor: RGB };

/** Tag do Figma: pílula, ponto na cor do texto, rótulo mono. Retorna a largura. */
function desenharTag(g: Pagina, t: Tag, x: number, y: number): number {
  const altura = 15;
  const tamanho = 6.8;
  const ponto = 3.7;
  const pad = 6.2;
  const largura = pad + ponto + 3.7 + g.larguraRotulo(t.texto, tamanho) + pad;
  const raio = Math.min(RAIO.pill, altura / 2);
  g.arredondado(x, y, largura, altura, [raio, raio, raio, raio], {
    cor: t.fundo,
    borda: t.borda,
    espessura: 0.6,
  });
  g.p.drawCircle({
    x: x + pad + ponto / 2,
    y: ALTURA - y - altura / 2,
    size: ponto / 2,
    color: t.cor,
  });
  g.rotulo(t.texto, x + pad + ponto + 3.7, y + altura / 2 + tamanho * 0.36, tamanho, t.cor);
  return largura;
}

export async function gerarComprovante(d: DadosComprovante): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Comprovante de inscrição — ${d.numero}`);
  pdf.setAuthor(EVENTO.sigla);
  pdf.setSubject(`${EVENTO.sigla} — ${EVENTO.nome}`);
  pdf.setCreationDate(d.emitidoEm);

  const pagina = pdf.addPage([LARGURA, ALTURA]);
  const m = await carregarMarca(pdf, { faixa: true });
  const g = new Pagina(pagina, m);

  // Faixa halftone (Textura/Ribbon, modo Light) sobre bg-000, com fio line-100 de corte seco.
  g.retangulo(0, 0, LARGURA, ALTURA_FAIXA, C.fundo);
  if (m.faixa) {
    const alturaImagem = (m.faixa.height / m.faixa.width) * LARGURA;
    pagina.pushOperators(
      pushGraphicsState(),
      rectangle(0, ALTURA - ALTURA_FAIXA, LARGURA, ALTURA_FAIXA),
      clip(),
      endPath(),
    );
    pagina.drawImage(m.faixa, {
      x: 0,
      y: ALTURA - ALTURA_FAIXA / 2 - alturaImagem / 2,
      width: LARGURA,
      height: alturaImagem,
    });
    pagina.pushOperators(popGraphicsState());
  }
  g.linha(0, LARGURA, ALTURA_FAIXA, C.linha);

  // Selo lima com ✓ + rótulo de sistema (como em /confirmacao).
  let y = ALTURA_FAIXA + 28;
  const selo = 18;
  g.retangulo(MARGEM, y, selo, selo, C.lima);
  pagina.drawSvgPath('M5 12.5l4.5 4.5L19 7.5', {
    x: MARGEM,
    y: ALTURA - y,
    scale: selo / 24,
    borderColor: C.sobreLima,
    borderWidth: 2.6,
    borderLineCap: LineCapStyle.Round,
  });
  g.rotulo(`Comprovante · ${EVENTO.sigla}`, MARGEM + selo + 10, y + 12.5, 9, C.limaTinta);

  // Título display (Pixelify Sans), reduzido se não couber.
  const titulo = 'Inscrição confirmada.';
  let tamTitulo = 38;
  while (g.largura(titulo, m.display, tamTitulo) > UTIL && tamTitulo > 26) tamTitulo -= 1;
  y += selo + 14 + tamTitulo * 0.8;
  g.texto(titulo, MARGEM, y, m.display, tamTitulo, C.tinta);

  // Data em Doto + rótulo mono com o nome do evento (Cartaz A5 › Data).
  const { dias, mesAno } = datasEmDestaque();
  y += 40;
  g.texto(dias, MARGEM, y, m.numeral, 28, C.tinta);
  const xRotuloData = MARGEM + g.largura(dias, m.numeral, 28) + 12;
  let tamData = 9;
  const rotuloData = `${mesAno} · ${EVENTO.nome}`;
  while (xRotuloData + g.larguraRotulo(rotuloData, tamData) > MARGEM + UTIL && tamData > 6) {
    tamData -= 0.5;
  }
  g.rotulo(rotuloData, xRotuloData, y, tamData, C.tinta2);
  y += 22;

  // Tags (Formatos): o que a inscrição inclui. Palestra=Lima, Minicurso=Azul, Trabalhos=Contorno.
  const tags: Tag[] = [{ texto: 'Palestras', fundo: C.lima900, cor: C.limaTinta }];
  if (d.minicurso) tags.push({ texto: 'Minicurso', fundo: C.azul900, cor: C.azulTinta });
  if (d.trabalho) tags.push({ texto: 'Trabalhos', borda: C.linhaForte, cor: C.tinta2 });
  let xTag = MARGEM;
  for (const t of tags) xTag += desenharTag(g, t, xTag, y - 4) + 8;
  y += 28;

  // ---- Quando e onde (medido antes: o painel precisa deixar espaço para ele) -------------------
  const topoRodape = ALTURA - 76;
  const larguraCol = (UTIL - 24) / 2;
  const colunas = (
    [
      ['Quando', [EVENTO.datasTexto, EVENTO.local.detalhe]],
      ['Onde', [EVENTO.local.nome, EVENTO.local.endereco]],
    ] as const
  ).map(([rotulo, textos]) => ({
    rotulo,
    linhas: textos.flatMap((t) => quebrarLinhas(g.seguro(t, m.texto), m.texto, 10, larguraCol)),
  }));
  const alturaQuando = 15 + (Math.max(...colunas.map((c) => c.linhas.length)) - 1) * 13.5;

  // ---- Panel: cabeçalho de sistema, corpo e faixa de pontos -------------------------------------
  const topoPainel = y;
  const pad = 20;
  const ladoQr = 140;
  const xQr = MARGEM + UTIL - pad - ladoQr;
  const xEsq = MARGEM + pad;
  const larguraEsq = xQr - 24 - xEsq;
  const larguraCheia = UTIL - 2 * pad;
  const cabecalho = 28;
  const alturaFaixaPontos = 24;

  /**
   * Posiciona o corpo do painel sem desenhar. `compacto` (texto 10 pt, menos respiro) só entra
   * quando nomes/títulos muito longos não deixariam o "Quando e onde" caber acima do rodapé.
   */
  const planejarPainel = (compacto: boolean) => {
    const tam = compacto ? 10 : 11;
    const entre = compacto ? 13 : 15;
    const aposRotulo = compacto ? 18 : 22;
    const respiro = compacto ? 10 : 16;
    const desenhos: (() => void)[] = [];
    let yc = topoPainel + cabecalho + pad;

    // Número de inscrição em BoundingBox (etiqueta lima + caixa com contorno lima).
    const yRotuloNumero = yc;
    desenhos.push(() => g.rotulo('Número de inscrição', xEsq, yRotuloNumero + 7, 7.5, C.tinta2));
    yc += 14;
    const yEtiqueta = yc;
    desenhos.push(() => {
      const [parte1, parte2, t] = ['inscrição', 'confirmada', 8.5];
      const l1 = g.largura(parte1, m.monoMedio, t);
      const l2 = g.largura(parte2, m.mono, t);
      g.retangulo(xEsq, yEtiqueta, 6 + l1 + 6 + l2 + 6, 14, C.lima);
      g.texto(parte1, xEsq + 6, yEtiqueta + 10, m.monoMedio, t, C.sobreLima);
      g.texto(parte2, xEsq + 6 + l1 + 6, yEtiqueta + 10, m.mono, t, C.sobreLima);
    });
    yc += 14;
    const yCaixa = yc;
    const tamNumero = 26;
    desenhos.push(() => {
      const l = g.largura(d.numero, m.numeral, tamNumero) + 2 * 10;
      const a = tamNumero + 12;
      // Contorno de 2 pt por dentro da caixa (Figma: border inside).
      pagina.drawRectangle({
        x: xEsq + 1,
        y: ALTURA - yCaixa - a + 1,
        width: l - 2,
        height: a - 2,
        borderColor: C.lima,
        borderWidth: 2,
      });
      g.texto(d.numero, xEsq + 10, yCaixa + 6 + tamNumero * 0.8, m.numeral, tamNumero, C.tinta);
    });
    yc += tamNumero + 12 + 18;

    const campo = (rotulo: string, valor: string, largura: number) => {
      const yRot = yc;
      const linhas = quebrarLinhas(g.seguro(valor, m.texto), m.texto, tam, largura);
      desenhos.push(() => {
        g.rotulo(rotulo, xEsq, yRot + 7, 7.5, C.tinta3);
        linhas.forEach((l, i) =>
          g.texto(l, xEsq, yRot + aposRotulo + i * entre, m.texto, tam, C.tinta),
        );
      });
      yc += aposRotulo + (linhas.length - 1) * entre + respiro;
    };
    campo('Nome', d.nome, larguraEsq);
    campo('CPF', d.cpfMascarado, larguraEsq);
    campo('Palestras e apresentações', 'Todos os dias do evento', larguraEsq);

    // QR à direita do bloco do número; abaixo dele, campos em largura cheia.
    const yQr = topoPainel + cabecalho + pad;
    const legenda = 'Apresente no credenciamento';
    desenhos.push(() => {
      desenharQr(g, d.qr, xQr, yQr, ladoQr);
      g.rotulo(
        legenda,
        xQr + ladoQr / 2 - g.larguraRotulo(legenda, 6.5) / 2,
        yQr + ladoQr + 14,
        6.5,
        C.tinta2,
      );
    });
    yc = Math.max(yc, yQr + ladoQr + 30);

    campo('E-mail', d.email, larguraCheia);
    campo('Minicurso', d.minicurso ?? 'Não inscrito', larguraCheia);
    campo('Trabalho submetido', d.trabalho ?? 'Nenhum', larguraCheia);
    const fimCorpo = yc - respiro + pad;
    return { fimCorpo, alturaPainel: fimCorpo + alturaFaixaPontos - topoPainel, desenhos };
  };
  const folga = 18; // entre o painel e o "Quando e onde"
  const limite = topoRodape - 12 - alturaQuando - folga;
  let plano = planejarPainel(false);
  if (topoPainel + plano.alturaPainel > limite) plano = planejarPainel(true);
  const { fimCorpo, alturaPainel, desenhos } = plano;

  // Fundo e borda do Panel (bg-200, line-100, radius-2).
  const r = RAIO.r2;
  g.arredondado(MARGEM, topoPainel, UTIL, alturaPainel, [r, r, r, r], { cor: C.papel });
  // Faixa de pontos (Panel › Faixa de pontos): bg-100, pontos line-200 de 3 pt a cada ~8 pt.
  g.arredondado(MARGEM, fimCorpo, UTIL, alturaFaixaPontos, [0, 0, r, r], { cor: C.faixa });
  g.linha(MARGEM, MARGEM + UTIL, fimCorpo, C.linha);
  for (let fy = fimCorpo + 1.5; fy < fimCorpo + alturaFaixaPontos - 2; fy += 8) {
    for (let fx = MARGEM + 1.475; fx < MARGEM + UTIL - 2; fx += 7.95) {
      pagina.drawCircle({ x: fx, y: ALTURA - fy, size: 1.5, color: C.linhaForte });
    }
  }
  g.arredondado(MARGEM, topoPainel, UTIL, alturaPainel, [r, r, r, r], { borda: C.linha });

  // Cabeçalho: LED lima + rótulo; emissão à direita.
  pagina.drawRectangle({
    x: MARGEM + pad,
    y: ALTURA - topoPainel - cabecalho / 2 - 3,
    width: 6,
    height: 6,
    color: C.lima,
  });
  g.rotulo('Dados da inscrição', MARGEM + pad + 14, topoPainel + cabecalho / 2 + 3, 7.5, C.tinta);
  const emitido = `Emitido em ${formatoData.format(d.emitidoEm)} · horário de Maceió`;
  g.rotulo(
    emitido,
    MARGEM + UTIL - pad - g.larguraRotulo(emitido, 7.5),
    topoPainel + cabecalho / 2 + 3,
    7.5,
    C.tinta3,
  );
  g.linha(MARGEM, MARGEM + UTIL, topoPainel + cabecalho, C.linha);
  for (const desenhar of desenhos) desenhar();

  // ---- Quando e onde (duas colunas) ------------------------------------------------------------
  y = Math.min(topoPainel + alturaPainel + 26, topoRodape - 12 - alturaQuando);
  colunas.forEach(({ rotulo, linhas }, i) => {
    const x = MARGEM + i * (larguraCol + 24);
    g.rotulo(rotulo, x, y, 7.5, C.limaTinta);
    linhas.forEach((l, j) => g.texto(l, x, y + 15 + j * 13.5, m.texto, 10, C.tinta));
  });

  // ---- Rodapé: fio line-100, logo IC-ML à esquerda e logo conjunto (≥ 8 mm) à direita ----------
  g.linha(MARGEM, MARGEM + UTIL, topoRodape, C.linha);
  if (m.logoIcml) {
    const a = 20;
    pagina.drawImage(m.logoIcml, {
      x: MARGEM,
      y: ALTURA - topoRodape - 12 - 4 - a,
      width: (m.logoIcml.width / m.logoIcml.height) * a,
      height: a,
    });
  } else {
    g.texto(EVENTO.sigla, MARGEM, topoRodape + 30, m.display, 18, C.tinta);
  }
  if (m.logoConjunto) {
    const a = 28; // 9,9 mm
    const l = (m.logoConjunto.width / m.logoConjunto.height) * a;
    pagina.drawImage(m.logoConjunto, {
      x: MARGEM + UTIL - l,
      y: ALTURA - topoRodape - 12 - a,
      width: l,
      height: a,
    });
  }
  for (const [i, parte] of quebrarLinhas(
    g.seguro(`Realização: ${EVENTO.realizacao}.`, m.mono),
    m.mono,
    6.5,
    UTIL,
  ).entries()) {
    g.texto(parte, MARGEM, topoRodape + 54 + i * 9, m.mono, 6.5, C.tinta3);
  }

  return pdf.save();
}
