// Spike WML-12: envio pelo Gmail do evento (SMTP 465) com PDF + .ics anexos.
// Uso: npm run spike:email   (lê GMAIL_USER e GMAIL_APP_PASSWORD do .env)
// Envia SOMENTE para a própria conta do evento. Nunca imprime a senha.
import nodemailer from 'nodemailer';
import { eventosDeAgenda } from '../src/data/evento.ts';
import { gerarIcs } from '../src/lib/agenda.ts';

const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
  console.error('Defina GMAIL_USER e GMAIL_APP_PASSWORD no .env (veja .env.example).');
  process.exit(1);
}

// PDF mínimo válido só para testar anexo e filtro de spam.
const pdf = `%PDF-1.4
1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj
4 0 obj<</Length 66>>stream
BT /F1 18 Tf 72 760 Td (IC-ML 2026 - comprovante de teste) Tj ET
endstream endobj
5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
trailer<</Root 1 0 R>>
%%EOF`;

const transporte = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
});

const t0 = performance.now();
await transporte.verify();
const tConexao = performance.now() - t0;

const info = await transporte.sendMail({
  from: `"IC-ML 2026" <${GMAIL_USER}>`,
  to: GMAIL_USER,
  subject: 'IC-ML 2026 · Inscrição confirmada · ICML26-TESTE',
  text: [
    'Olá, Participante Exemplo!',
    '',
    'Sua inscrição no IC-ML 2026 (02 a 04/12, Instituto de Computação — UFAL) está confirmada.',
    'Número de inscrição: ICML26-TESTE',
    '',
    'O comprovante está em anexo. Para adicionar o evento à agenda, abra o arquivo .ics anexo.',
    '',
    'Esta é uma mensagem de teste do spike WML-12.',
  ].join('\n'),
  html: `<p>Olá, <strong>Participante Exemplo</strong>!</p>
<p>Sua inscrição no <strong>IC-ML 2026</strong> (02 a 04/12, Instituto de Computação — UFAL) está confirmada.</p>
<p>Número de inscrição: <strong style="font-family:monospace">ICML26-TESTE</strong></p>
<p>O comprovante está em anexo. Para adicionar o evento à agenda, abra o arquivo <code>.ics</code> anexo.</p>
<p style="color:#666">Esta é uma mensagem de teste do spike WML-12.</p>`,
  attachments: [
    { filename: 'comprovante-ICML26-TESTE.pdf', content: pdf, contentType: 'application/pdf' },
    {
      filename: 'ic-ml-2026.ics',
      content: gerarIcs(eventosDeAgenda()),
      contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
    },
  ],
});

const tTotal = performance.now() - t0;
console.log(
  JSON.stringify(
    {
      ok: info.rejected.length === 0,
      aceitos: info.accepted.length,
      rejeitados: info.rejected.length,
      resposta: info.response,
      conexaoMs: Math.round(tConexao),
      totalMs: Math.round(tTotal),
    },
    null,
    2,
  ),
);
