# ADR-002 — Template de certificado em PDF (não DOCX)

- Status: Aceito (16/10/2026)
- Contexto: a organização quer enviar um modelo de certificado e apenas indicar onde entram Nome completo, CPF e carga horária. Foram considerados PDF e DOCX.

## Decisão
Usar **PDF** como formato do template. A organização sobe o PDF, vê a prévia (pdf.js) e arrasta caixas para **Nome**, **CPF** e **Horas**; o sistema guarda página, coordenadas, largura, tamanho e alinhamento da fonte. A geração usa `pdf-lib` dentro de Edge Functions, escrevendo o texto sobre o template.

## Por quê
- `pdf-lib` roda em Deno/Edge sem dependências nativas — custo zero, sem servidor.
- DOCX exigiria converter para PDF (LibreOffice/Gotenberg), o que não roda em infraestrutura gratuita serverless.
- O resultado visual é exatamente o template aprovado pela organização (sem variação de fontes/quebras do Word).

## Consequências
- Nomes longos: auto-ajuste do tamanho da fonte para caber na caixa.
- Fontes: embutir Montserrat/Open Sans (licença OFL) para acentuação correta.
- Quem tiver o modelo em DOCX exporta para PDF antes de subir (Word/Google Docs → "Salvar como PDF").
