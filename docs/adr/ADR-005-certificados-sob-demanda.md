# ADR-005 — Certificados gerados sob demanda, validação por código aleatório

- Status: Aceito (20/10/2026)
- Contexto: complementa o [ADR-002](ADR-002-certificado-pdf.md) (template PDF + `pdf-lib`). Depois do evento, a organização clica em "Liberar certificados"; cada participante com horas > 0 recebe o certificado por e-mail (fila com teto diário) e pode baixá-lo de novo numa página pública. Qualquer pessoa precisa conseguir conferir a autenticidade de um certificado. Storage gratuito: 1 GB, já usado pelos PDFs dos trabalhos.

## Decisão

1. **Não guardar PDFs de certificado.** O banco guarda só a emissão (`certificados`: participante, horas, código de validação, data). O PDF é montado na hora — no envio do e-mail (`send-emails`) e no download (Edge Function `certificado`) — a partir do template e das posições salvas.
2. **CPF completo só dentro da Edge Function** que monta o PDF (exceção prevista no CLAUDE.md, regra 2). Em qualquer outra saída — validação pública, painel, logs — sai mascarado.
3. **Horas congeladas na liberação.** "Liberar" calcula as horas (`horas_participante()`) e grava em `certificados.horas`. Presença ou carga horária alterada depois não muda o certificado já emitido; para corrigir, a organização reemite.
4. **Código de validação aleatório** de 128 bits (base32 legível, ex.: `K7QF-3M2D-…`), não sequencial e sem relação com o número de inscrição. A página `/validar` mostra nome, horas e data de emissão e o CPF mascarado.
5. **Download por e-mail + número de inscrição**, com Turnstile e limite por origem. A resposta é a mesma para "não encontrado" e "ainda não liberado", para não revelar quem está inscrito.

## Por quê

- Sem PDFs no Storage: zero consumo de cota, nada para expurgar além das linhas do banco, e o mesmo certificado nunca existe em duas versões.
- Gerar um PDF com `pdf-lib` leva milissegundos e já é feito para o comprovante no `send-emails`.
- Código aleatório de 128 bits torna a enumeração inviável; o número de inscrição (sequencial) nunca serve para validar.

## Consequências

- Trocar o template **depois** da liberação muda a aparência dos próximos downloads (as horas e o código continuam os mesmos). O painel avisa isso.
- O expurgo (S6) apaga CPF e e-mail em 31/03/2027; depois disso o download deixa de existir e a validação pública continua por código até 31/12/2031 (nome, horas, data).
- Fontes: por ora, as **fontes padrão do PDF** (Helvetica e Times, normal e negrito), escolhidas no painel. Cobrem os acentos do português, não exigem arquivo extra nem `@pdf-lib/fontkit`, e qualquer leitor de PDF as exibe. Caracteres fora do Latin-1 (raros em nomes) viram o equivalente sem acento ou "?". Isso substitui o "embutir Montserrat/Open Sans" do ADR-002; se a organização quiser a fonte da marca, embutir a TTF (OFL) é uma mudança pequena no gerador. Nomes longos reduzem a fonte até caber na caixa.
- O gerador remove JavaScript, ações automáticas e anexos que viessem no modelo (S5, T4).
