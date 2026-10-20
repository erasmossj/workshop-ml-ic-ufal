// Certificado em PDF (WML-58/59 · ADR-002 · ADR-005): escreve Nome, CPF e Horas sobre o modelo da
// organização, nas posições salvas no painel. Usado no e-mail, no download e na prévia do painel.
// CPF completo só aqui dentro (CLAUDE.md, regra 2). O texto é desenhado como texto (pdf-lib
// codifica em hex): nada do nome é interpretado como comando de PDF.
import { PDFDocument, rgb, StandardFonts, type PDFFont } from 'pdf-lib';
import { paraWinAnsi } from './winansi.ts';

export type Fonte = 'helvetica' | 'helvetica-negrito' | 'times' | 'times-negrito';
export type Alinhamento = 'esquerda' | 'centro' | 'direita';

/** Caixa em pontos do PDF, origem no canto superior esquerdo da página. */
export type Campo = {
  pagina: number;
  x: number;
  y: number;
  largura: number;
  tamanho: number;
  alinhamento: Alinhamento;
  fonte: Fonte;
};
export type Campos = { nome: Campo; cpf: Campo; horas: Campo };

export type DadosCertificado = {
  nome: string;
  /** 11 dígitos. */
  cpf: string;
  minutos: number;
  codigo: string;
  /** Página pública de validação (ex.: https://<site>/validar). */
  urlValidacao: string;
};

const FONTES: Record<Fonte, StandardFonts> = {
  helvetica: StandardFonts.Helvetica,
  'helvetica-negrito': StandardFonts.HelveticaBold,
  times: StandardFonts.TimesRoman,
  'times-negrito': StandardFonts.TimesRomanBold,
};
const TAMANHO_MINIMO = 6;
const CINZA = rgb(0.35, 0.38, 0.45);

/** 1320 → "22 horas"; 60 → "1 hora"; 830 → "13h50". */
export function formatarCargaHoraria(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (m === 0) return `${h} ${h === 1 ? 'hora' : 'horas'}`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

export function formatarCpf(cpf: string): string {
  const d = cpf.replace(/\D/g, '');
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9, 11)}`;
}

/** Maior tamanho (até `tamanho`) em que o texto cabe na largura; nunca abaixo de 6 pt. */
export function tamanhoQueCabe(
  fonte: PDFFont,
  texto: string,
  tamanho: number,
  largura: number,
): number {
  const larguraNoTamanho = fonte.widthOfTextAtSize(texto, tamanho);
  if (larguraNoTamanho <= largura) return tamanho;
  const ajustado = Math.floor(((tamanho * largura) / larguraNoTamanho) * 10) / 10;
  return Math.max(TAMANHO_MINIMO, ajustado);
}

export function posicaoX(
  alinhamento: Alinhamento,
  x: number,
  largura: number,
  larguraTexto: number,
) {
  if (alinhamento === 'centro') return x + (largura - larguraTexto) / 2;
  if (alinhamento === 'direita') return x + largura - larguraTexto;
  return x;
}

export async function gerarCertificado(
  modelo: Uint8Array,
  campos: Campos,
  dados: DadosCertificado,
): Promise<Uint8Array> {
  let pdf: PDFDocument;
  try {
    pdf = await PDFDocument.load(modelo, { updateMetadata: false });
  } catch {
    throw new Error('MODELO_ILEGIVEL');
  }
  const paginas = pdf.getPages();
  const cache = new Map<Fonte, PDFFont>();
  const fonte = async (f: Fonte) => {
    if (!cache.has(f)) cache.set(f, await pdf.embedFont(FONTES[f]));
    return cache.get(f)!;
  };

  const textos: [Campo, string][] = [
    [campos.nome, dados.nome],
    [campos.cpf, formatarCpf(dados.cpf)],
    [campos.horas, formatarCargaHoraria(dados.minutos)],
  ];
  for (const [campo, bruto] of textos) {
    const pagina = paginas[campo.pagina];
    if (!pagina) throw new Error('PAGINA_INEXISTENTE');
    const f = await fonte(campo.fonte);
    const texto = paraWinAnsi(bruto, new Set(f.getCharacterSet()));
    const tamanho = tamanhoQueCabe(f, texto, campo.tamanho, campo.largura);
    const largura = f.widthOfTextAtSize(texto, tamanho);
    const { height } = pagina.getSize();
    pagina.drawText(texto, {
      x: posicaoX(campo.alinhamento, campo.x, campo.largura, largura),
      // y do painel = topo da caixa; a linha de base fica ~80% do tamanho abaixo dele.
      y: height - campo.y - campo.tamanho * 0.8 - (campo.tamanho - tamanho) / 2,
      size: tamanho,
      font: f,
    });
  }

  // Rodapé de autenticidade na 1ª página: código + onde conferir.
  const rodape = await fonte('helvetica');
  const linha = paraWinAnsi(
    `Código de validação: ${dados.codigo} · confira em ${dados.urlValidacao}`,
    new Set(rodape.getCharacterSet()),
  );
  const primeira = paginas[0];
  const { width } = primeira.getSize();
  const tamanhoRodape = tamanhoQueCabe(rodape, linha, 8, width - 40);
  primeira.drawText(linha, {
    x: (width - rodape.widthOfTextAtSize(linha, tamanhoRodape)) / 2,
    y: 14,
    size: tamanhoRodape,
    font: rodape,
    color: CINZA,
  });

  pdf.setTitle('Certificado — IC-ML 2026');
  pdf.setAuthor('IC-ML 2026');
  pdf.setSubject(`Código de validação ${dados.codigo}`);
  pdf.setProducer('IC-ML 2026');
  pdf.setCreator('IC-ML 2026');
  return pdf.save();
}
