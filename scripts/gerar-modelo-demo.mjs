// Gera um modelo de certificado de EXEMPLO para a demonstração (WML-40): A4 deitado, com espaços
// em branco para Nome, CPF e carga horária. Não é o certificado oficial — a organização envia o
// aprovado no painel. Só texto fixo, nenhum dado de participante.
//
//   node scripts/gerar-modelo-demo.mjs [saida.pdf]   (padrão: modelo-certificado-demo.pdf)
import { writeFileSync } from 'node:fs';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

const saida = process.argv[2] ?? 'modelo-certificado-demo.pdf';

const pdf = await PDFDocument.create();
pdf.setTitle('Modelo de certificado (demonstração) — IC-ML 2026');
const pagina = pdf.addPage([841.89, 595.28]);
const { width, height } = pagina.getSize();
const normal = await pdf.embedFont(StandardFonts.Helvetica);
const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
const azul = rgb(0, 0.38, 0.65);
const cinza = rgb(0.35, 0.35, 0.35);

function centro(texto, y, fonte, tamanho, cor = rgb(0, 0, 0)) {
  const x = (width - fonte.widthOfTextAtSize(texto, tamanho)) / 2;
  pagina.drawText(texto, { x, y, size: tamanho, font: fonte, color: cor });
}
function linha(x, y, largura) {
  pagina.drawLine({ start: { x, y }, end: { x: x + largura, y }, thickness: 0.6, color: cinza });
}

pagina.drawRectangle({
  x: 24,
  y: 24,
  width: width - 48,
  height: height - 48,
  borderColor: azul,
  borderWidth: 2,
});
pagina.drawRectangle({ x: 24, y: height - 70, width: width - 48, height: 46, color: azul });
centro('IC-ML 2026 · Workshop de Machine Learning do IC', height - 54, negrito, 16, rgb(1, 1, 1));

centro('CERTIFICADO', height - 140, negrito, 40, azul);
centro('Certificamos que', height - 195, normal, 16);
linha(170, height - 250, width - 340); // Nome

const cpf = 'portador(a) do CPF';
pagina.drawText(cpf, { x: 170, y: height - 300, size: 16, font: normal });
linha(170 + normal.widthOfTextAtSize(cpf, 16) + 8, height - 302, 170); // CPF

centro(
  'participou do Workshop de Machine Learning do IC (IC-ML 2026), realizado de 2 a 4',
  height - 340,
  normal,
  16,
);
centro(
  'de dezembro de 2026 no Instituto de Computação da UFAL, Maceió/AL,',
  height - 365,
  normal,
  16,
);
const horas = 'com carga horária total de';
const xHoras = (width - 330) / 2;
pagina.drawText(horas, { x: xHoras, y: height - 390, size: 16, font: normal });
linha(xHoras + normal.widthOfTextAtSize(horas, 16) + 8, height - 392, 110); // Horas ("22 horas")

linha(150, 130, 220);
linha(width - 370, 130, 220);
pagina.drawText('Coordenação do evento', { x: 195, y: 112, size: 11, font: normal, color: cinza });
pagina.drawText('IEEE Computer Society UFAL', {
  x: width - 340,
  y: 112,
  size: 11,
  font: normal,
  color: cinza,
});
centro(
  'MODELO DE DEMONSTRAÇÃO — substituir pelo certificado aprovado pela organização',
  70,
  negrito,
  9,
  cinza,
);
// A faixa de baixo (y < 40) fica livre: o sistema escreve ali o código de validação.

writeFileSync(saida, await pdf.save());
console.log(`Modelo gerado: ${saida}`);
