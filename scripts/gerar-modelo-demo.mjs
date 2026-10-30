// Gera um modelo de certificado de EXEMPLO para a demonstração (WML-40): A4 deitado, com espaços
// em branco para Nome, CPF e carga horária. Não é o certificado oficial — a organização envia o
// aprovado no painel. Só texto fixo, nenhum dado de participante.
// Identidade final (WML-68): modo Light (impressos) do Figma "IC-ML" — mesmas fontes, cores e
// logos do comprovante (supabase/functions/_shared/marca.ts).
//
//   node scripts/gerar-modelo-demo.mjs [saida.pdf]   (padrão: modelo-certificado-demo.pdf)
import { writeFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { carregarMarca, COR, rgbDe } from '../supabase/functions/_shared/marca.ts';

const saida = process.argv[2] ?? 'modelo-certificado-demo.pdf';

const pdf = await PDFDocument.create();
pdf.setTitle('Modelo de certificado (demonstração) — IC-ML 2026');
const pagina = pdf.addPage([841.89, 595.28]);
const { width, height } = pagina.getSize();
const m = await carregarMarca(pdf);
const tinta = rgbDe(COR.ink100);
const suave = rgbDe(COR.ink300);
const linhaCor = rgbDe(COR.line200);

function centro(texto, y, fonte, tamanho, cor = tinta) {
  const x = (width - fonte.widthOfTextAtSize(texto, tamanho)) / 2;
  pagina.drawText(texto, { x, y, size: tamanho, font: fonte, color: cor });
}
function linha(x, y, largura) {
  pagina.drawLine({
    start: { x, y },
    end: { x: x + largura, y },
    thickness: 0.75,
    color: linhaCor,
  });
}

// Moldura (line-100) e topo off-white com fio lima de corte seco.
pagina.drawRectangle({
  x: 24,
  y: 24,
  width: width - 48,
  height: height - 48,
  borderColor: rgbDe(COR.line100),
  borderWidth: 1,
});
pagina.drawRectangle({
  x: 25,
  y: height - 96,
  width: width - 50,
  height: 71,
  color: rgbDe(COR.bg000),
});
pagina.drawRectangle({
  x: 25,
  y: height - 99,
  width: width - 50,
  height: 3,
  color: rgbDe(COR.lime500),
});
if (m.logoIcml) {
  const h = 28;
  pagina.drawImage(m.logoIcml, {
    x: 56,
    y: height - 75,
    width: (m.logoIcml.width / m.logoIcml.height) * h,
    height: h,
  });
}
const rotulo = 'CERTIFICADO DE PARTICIPAÇÃO';
pagina.drawText(rotulo, {
  x: width - 56 - m.monoMedio.widthOfTextAtSize(rotulo, 9),
  y: height - 64,
  size: 9,
  font: m.monoMedio,
  color: suave,
});

centro('Certificado', height - 160, m.textoForte, 40);
centro('Certificamos que', height - 205, m.texto, 16, suave);
linha(170, height - 250, width - 340); // Nome

const cpf = 'portador(a) do CPF';
pagina.drawText(cpf, { x: 170, y: height - 300, size: 16, font: m.texto, color: tinta });
linha(170 + m.texto.widthOfTextAtSize(cpf, 16) + 8, height - 302, 170); // CPF

centro(
  'participou do Workshop de Machine Learning do IC (IC-ML 2026), realizado de 2 a 4',
  height - 340,
  m.texto,
  16,
);
centro(
  'de dezembro de 2026 no Instituto de Computação da UFAL, Maceió/AL,',
  height - 365,
  m.texto,
  16,
);
const horas = 'com carga horária total de';
const xHoras = (width - 330) / 2;
pagina.drawText(horas, { x: xHoras, y: height - 390, size: 16, font: m.texto, color: tinta });
linha(xHoras + m.texto.widthOfTextAtSize(horas, 16) + 8, height - 392, 110); // Horas ("22 horas")

linha(150, 150, 220);
linha(width - 370, 150, 220);
pagina.drawText('Coordenação do evento', { x: 195, y: 132, size: 11, font: m.texto, color: suave });
pagina.drawText('IEEE Computer Society UFAL', {
  x: width - 340,
  y: 132,
  size: 11,
  font: m.texto,
  color: suave,
});

// Logo conjunto IEEE × CS × IC: obrigatório, altura mínima de 8 mm (≈ 23 pt).
if (m.logoConjunto) {
  const h = 30;
  const w = (m.logoConjunto.width / m.logoConjunto.height) * h;
  pagina.drawImage(m.logoConjunto, { x: (width - w) / 2, y: 78, width: w, height: h });
}
centro(
  'MODELO DE DEMONSTRAÇÃO — substituir pelo certificado aprovado pela organização',
  56,
  m.monoMedio,
  8,
  suave,
);
// A faixa de baixo (y < 40) fica livre: o sistema escreve ali o código de validação.

writeFileSync(saida, await pdf.save());
console.log(`Modelo gerado: ${saida}`);
