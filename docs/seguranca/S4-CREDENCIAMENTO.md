# Segurança do credenciamento (S4) — IC-ML 2026

> WML-50. Escopo: QR do comprovante, Edge Function `check-in`, RPC `check_in()`, tabela
> `presencas`, leitor `/credenciamento` e painel de presenças. Decisões:
> [ADR-004](../adr/ADR-004-credenciamento-qr.md). Critério: **0 achados Alto/Crítico**.

## Como reproduzir

| Parte                | Como rodar                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| Banco (RLS, RPC)     | `npm run test:db` → `supabase/tests/database/credenciamento.test.sql` (31 casos)               |
| Função (lógica)      | `npm test` → `supabase/functions/_shared/check-in.test.ts` (15 casos)                          |
| Função (login real)  | `npm run test:integracao` → `tests/integracao/check-in.test.ts` (8 casos, Supabase local)      |
| API no staging       | `BASE_URL=… ANON_KEY=… node scripts/pentest-staging.mjs` → casos **C10** (+ C1/C2 atualizados) |
| Leitor (câmera, axe) | E2E (`e2e/credenciamento.spec.ts`) e verificação com câmera simulada lendo um QR assinado      |

## Ameaças e mitigações — rodada 1 (20/10/2026)

| #   | Ameaça                                                                                | Mitigação                                                                                                                                                        | Evidência                                                                 | Risco residual |
| --- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------- |
| T1  | **Forjar QR** para outro número (gerar um QR com número alheio)                       | Token = número + HMAC-SHA256 (128 bits) com `QR_HMAC_SECRET`, que só existe no servidor; comparação em tempo constante                                           | Integração: "QR adulterado", "outro segredo"; unit `qr.test.ts`           | Baixo          |
| T2  | **Replay** do mesmo QR (ler duas vezes, dois operadores ao mesmo tempo)               | Unicidade `(participante, dia, minicurso)` no banco + `on conflict do nothing`: o segundo scan devolve "já registrado" e não grava nada                          | pgTAP "repetir o scan não duplica"; câmera simulada lendo o QR sem parar  | Baixo          |
| T3  | **Print do QR de outra pessoa** (presença para quem faltou)                           | Tela mostra o nome completo para conferência; dúvida → documento com foto. QR estático por decisão (ADR-004)                                                     | Risco **aceito** pela organização no ADR-004                              | Baixo (aceito) |
| T4  | **Operador falso**: chamar a função sem login, com a chave pública ou com JWT forjado | `auth.getUser()` valida o JWT no Auth; allowlist `organizadores` na função **e** dentro da RPC; `check_in()` só executa como `service_role`                      | Integração 401/403; pgTAP de privilégios; pentest C10                     | Baixo          |
| T5  | **Organizador chamando a RPC direto** (pular a verificação do QR)                     | `check_in()` não tem `grant` para `authenticated`; só a Edge Function chama                                                                                      | pgTAP "authenticated NÃO chama check_in direto"; allowlist em `seguranca` | Baixo          |
| T6  | **Injeção** pelo corpo da requisição (número, dia, modo)                              | Validação estrita antes do banco (regex de token, número e data; modo em lista fechada); RPC parametrizada                                                       | Unit: 8 entradas inválidas → 400 sem tocar no banco                       | Baixo          |
| T7  | **Vazamento de dado pessoal** no leitor, nas respostas ou nos logs                    | Resposta só com resultado, número e nome; nada de CPF/e-mail na tela; logs passam por `erroSeguro()`                                                             | Unit "nunca menciona CPF ou e-mail"; `logs.test.ts`; verificação da tela  | Baixo          |
| T8  | **Celular do operador perdido** com sessão aberta                                     | Botão "Sair"; nenhuma lista guardada no aparelho (só em memória); RUNBOOK manda sair ao fim de cada turno; acesso revogado tirando o e-mail de `organizadores`   | RUNBOOK → Credenciamento no dia                                           | Baixo          |
| T9  | **Leitor offline** registrando sem confirmação                                        | Sem fila offline (ADR-004): sem rede, a tela diz "A presença NÃO foi registrada"; nada fica guardado no aparelho                                                 | Código do leitor (mensagem "Sem conexão")                                 | Baixo          |
| T10 | **Câmera** liberada para o site inteiro ou imagens enviadas a terceiros               | `Permissions-Policy: camera=(self)` só em `/credenciamento`; quadros decodificados no próprio aparelho (BarcodeDetector/jsQR), nada é enviado além do token lido | `vercel.json`; CSP sem `blob:`/`unsafe-*` (E2E de CSP)                    | Baixo          |
| T11 | **Vazamento de `QR_HMAC_SECRET`**                                                     | Segredo só nos secrets do Supabase; rotação invalida os comprovantes já enviados → fica para depois do evento (S6)                                               | ADR-004, consequências                                                    | Baixo          |
| T12 | **Abuso de volume** na função                                                         | Só organizador logado chega ao banco; o banco ignora repetição. Sem limite por origem (equipe pequena, uso interno)                                              | —                                                                         | Baixo          |

**Resultado da rodada 1: 0 Alto/Crítico, 0 Médio.** Todos os riscos residuais são baixos; T3 é
aceito no ADR-004.

## Staging — 20/10/2026

Depois do deploy da migration `20261020090000_credenciamento.sql` e da função `check-in` no
staging: **52 verificações, 51 OK, 0 falhas** (`scripts/pentest-staging.mjs`).

| #   | Caso                                                                                        | Resultado                            |
| --- | ------------------------------------------------------------------------------------------- | ------------------------------------ |
| C1  | `presencas` lida direto com a chave pública                                                 | ✅ 401                               |
| C2  | `check_in()` e `admin_resumo_presencas()` chamadas como anônimo                             | ✅ 404 · 401                         |
| C10 | `check-in`: GET; sem login; chave pública como login; JWT forjado com e-mail de organizador | ✅ 405 · 401 · 401 · 401             |
| C10 | CORS do `check-in` com origem desconhecida                                                  | ✅ sem `Access-Control-Allow-Origin` |

A única verificação pulada (C6, `<script>` no nome) é do S3 e foi barrada pelo limite por origem
desta rodada; já tinha passado em 19/10.

## Pendente

- Teste do leitor em aparelhos reais — iPhone (Safari, caminho jsQR) e Android (Chrome,
  `BarcodeDetector`) — pendência 16 em [`PENDENCIAS.md`](../PENDENCIAS.md).
