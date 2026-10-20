# Segurança dos certificados (S5) — IC-ML 2026

> WML-51. Escopo: carga horária e cálculo de horas, modelo em PDF (bucket `certificados`),
> liberação, e-mail, download (`/certificado` + Edge Function `certificado`) e validação pública
> (`/validar` + `validar_certificado()`). Decisões: [ADR-002](../adr/ADR-002-certificado-pdf.md) e
> [ADR-005](../adr/ADR-005-certificados-sob-demanda.md). Critério: **0 achados Alto/Crítico**
> antes da liberação.

## Como reproduzir

| Parte                      | Como rodar                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| Banco (RLS, RPCs, códigos) | `npm run test:db` → `supabase/tests/database/certificados.test.sql` (52 casos)                           |
| PDF, e-mail e download     | `npm test` → `certificado.test.ts`, `email-certificado.test.ts`, `download-certificado.test.ts`          |
| Ponta a ponta (login real) | `npm run test:integracao` → `tests/integracao/certificados.test.ts` (modelo → liberar → baixar → e-mail) |
| API no staging             | `BASE_URL=… ANON_KEY=… node scripts/pentest-staging.mjs` → casos **C11** (+ C1/C2 atualizados)           |
| Páginas (CSP, axe, sem JS) | `npx playwright test` → `certificados.spec.ts`, `csp.spec.ts`, `acessibilidade.spec.ts`                  |

## Ameaças e mitigações — rodada 1 (20/10/2026)

| #   | Ameaça                                                                                     | Mitigação                                                                                                                                                                          | Evidência                                                                     | Risco residual |
| --- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | -------------- |
| T1  | **Enumeração no download** (testar e-mails e números para descobrir quem participou)       | Exige e-mail **e** número juntos; Turnstile; limite por origem (10 a cada 10 min); "não encontrado" e "não liberado" têm a mesma resposta                                          | Unit (mesma resposta, ordem limite → Turnstile → banco); pentest C11 (429)    | Baixo          |
| T2  | **Enumeração na validação** (adivinhar códigos)                                            | Código aleatório de 100 bits (`gen_random_bytes`, base32 de Crockford), sem relação com o número de inscrição; código inexistente não devolve nada                                 | pgTAP (formato, unicidade); pentest C11                                       | Baixo          |
| T3  | **Injeção no modelo** (nome com operadores de PDF, `<script>`, caracteres fora do Latin-1) | O texto é desenhado como texto (pdf-lib codifica em hex); caracteres sem glifo viram equivalente sem acento ou "?"; HTML do e-mail escapado                                        | Unit "não interpreta o nome", "fora do Latin-1", "escapa o nome no HTML"      | Baixo          |
| T4  | **Modelo com código ativo** (JavaScript, ação ao abrir, anexos) copiado para todos         | Só organizadores enviam o modelo; o gerador remove `OpenAction`, `AA`, `JavaScript` e `EmbeddedFiles` antes de escrever; o editor do painel desenha com pdf.js sem `eval`          | Unit "remove JavaScript e ações automáticas"                                  | Baixo          |
| T5  | **PDF adulterado** (alguém edita as horas ou o nome no arquivo)                            | O rodapé traz o código; `/validar` mostra nome, horas e data **do banco**. O PDF não tem assinatura digital (ICP-Brasil teria custo)                                               | Integração (validação pública); ADR-005                                       | Baixo (aceito) |
| T6  | **Vazamento de CPF**                                                                       | CPF completo só em RPCs de servidor (`certificado_por_numero`, `certificado_para_download`) e dentro do PDF; validação e painel mascarados; e-mail sem CPF no corpo; logs saneados | pgTAP de privilégios; unit do e-mail; integração (texto do e-mail no Mailpit) | Baixo          |
| T7  | **Acesso ao modelo** por quem não é organizador                                            | Bucket privado; políticas de Storage só para `pode_administrar()`; anônimo não lista nem grava                                                                                     | pgTAP (intruso não grava); pentest C11                                        | Baixo          |
| T8  | **Liberação indevida ou repetida**                                                         | Só organizadores; idempotente (não reemite nem reenvia); exige modelo salvo; confirmação na tela; e-mails respeitam o teto diário                                                  | pgTAP "liberar de novo não duplica"                                           | Baixo          |
| T9  | **Horas mudando depois da emissão**                                                        | Horas congeladas em `certificados.minutos` na liberação                                                                                                                            | pgTAP "horas congeladas na emissão"                                           | Baixo          |
| T10 | **Abuso de CPU** gerando PDFs                                                              | Turnstile + limite por origem antes de gerar; só gera para certificado existente                                                                                                   | Unit (ordem das verificações)                                                 | Baixo          |
| T11 | **Formulário sem JavaScript** pondo e-mail e número na URL (como o P-03 do S3)             | `method="post"` em `/certificado`, no login do `/admin` e nos formulários do leitor                                                                                                | E2E "sem JavaScript não põe e-mail na URL"                                    | Baixo          |
| T12 | **Dados guardados além do prazo**                                                          | Nenhum PDF guardado; CPF e e-mail entram no expurgo de 31/03/2027 (S6), depois disso só a validação por código continua                                                            | ADR-005; WML-52                                                               | Baixo          |

**Resultado da rodada 1: 0 Alto/Crítico, 0 Médio.** T5 (sem assinatura digital) é aceito: a
autenticidade é conferida pelo código em `/validar`.

## Staging — 20/10/2026

Depois das migrations `20261021090000_certificados.sql` e `20261022090000_expurgo.sql` e das funções
`certificado`, `send-emails` e `expurgo` no staging: **74 verificações, 72 OK, 1 falha, 1 pulada**.

| #   | Caso                                                                                | Resultado                           |
| --- | ----------------------------------------------------------------------------------- | ----------------------------------- |
| C1  | Tabelas `atividades_certificado`, `certificados`, `config_certificado` como anônimo | ✅ 401                              |
| C2  | 11 RPCs de certificado (servidor e painel) como anônimo                             | ✅ 401/404                          |
| C11 | Bucket `certificados`: listar e gravar como anônimo                                 | ✅ lista vazia · 400                |
| C11 | `validar_certificado`: código inexistente e injeção                                 | ✅ vazio, sem erro de SQL           |
| C11 | `certificado`: GET, CORS de origem desconhecida, rajada de tentativas               | ✅ 405 · sem `Allow-Origin` · 429   |
| C11 | `certificado` com token falso do Turnstile                                          | ⚠️ passou do anti-robô (ver abaixo) |

**A falha não é do código**: o staging usa a **chave secreta de teste** do Turnstile, que aprova
qualquer token (necessária para o teste de carga do S3 passar). Conferido pelo hash do segredo, sem
ler o valor: staging = chave de teste; **produção = chave real**. A recusa de token inválido é
coberta pelos testes de unidade. O caso foi ajustado para conferir o envio **sem** token (deve ser
recusado), o único verificável no staging. A verificação pulada (C6) é do S3, barrada pelo limite
desta rodada, e já tinha passado em 19/10.

## Pendente

- Definir `SITE_URL` nos segredos das funções da **produção** (no staging já está): é o endereço
  impresso no rodapé do certificado e usado nos links do e-mail.
- Antes do go-live, conferir de novo que o `TURNSTILE_SECRET_KEY` da produção não é a chave de teste.
