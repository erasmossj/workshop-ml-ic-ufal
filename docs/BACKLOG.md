# Backlog — projeto Jira `WML`

> Issues criadas no Jira (`erasmojunior.atlassian.net`, projeto `WML`) em 16/10/2026. Datas = previsão de conclusão (2026). Itens feitos por IA ficam em "Fazendo" até revisão humana.

| Épico | Chave | Tasks |
|---|---|---|
| E1 Setup e governança | WML-1 | WML-10..13 |
| E2 Design e protótipos | WML-2 | WML-14..23 |
| E3 Front-end do site | WML-53 | WML-61..66 |
| E4 Inscrição (MVP) | WML-3 | WML-24..28 |
| E5 E-mail e comprovante | WML-4 | WML-29..31 |
| E6 Admin e exportação | WML-5 | WML-32..35 |
| E7 Carga, LGPD e operação | WML-6 | WML-36..40 |
| E8 Segurança (S1–S6) | WML-7 | WML-41..52 |
| E9 Credenciamento QR | WML-8 | WML-54..56 |
| E10 Certificados | WML-9 | WML-57..60 |

## E1 — Setup e governança
| # | Tarefa | Data | Fase |
|---|---|---|---|
| 1.1 | Repositório público + `CLAUDE.md` + plano + ADRs | 16/10 | F0 |
| 1.2 | Criar projetos Supabase (`prod`, `staging`), app Vercel e chaves Turnstile | 19/10 | F0 |
| 1.3 | Spike: envio de e-mail pelo Gmail do evento (limite real, Edge Function, entregabilidade) | 17/10 | F0 |
| 1.4 | Espaço Confluence `WML` espelhando `docs/` | 17/10 | F0 |

## E2 — Design e protótipos
| # | Tarefa | Data | Fase |
|---|---|---|---|
| 2.1 | Pesquisa de referências de sites de eventos + moodboard | 17/10 | F1 |
| 2.2 | Levantar ativos de marca IC/UFAL e IEEE CS; placeholders IEEE RE UFAL | 17/10 | F1 |
| 2.3 | Protótipo A — Institucional acadêmica | 17/10 | F1 |
| 2.4 | Protótipo B — Neural / dark tech | 17/10 | F1 |
| 2.5 | Protótipo C — Editorial bold | 17/10 | F1 |
| 2.6 | Protótipo D — Gradiente moderno | 17/10 | F1 |
| 2.7 | Protótipo E — Conversão primeiro | 17/10 | F1 |
| 2.8 | Rodada com stakeholders e escolha da direção | 18/10 | F1 |
| 2.9 | Tokens de design (cores, tipografia, espaçamento) da direção escolhida | 18/10 | F1 |
| 2.10 | Substituir placeholders pela marca do IEEE RE UFAL (quando recebida) | — | — |

## E3 — Front-end do site
| # | Tarefa | Data | Fase |
|---|---|---|---|
| 3.1 | Scaffold Astro + Tailwind + CI (lint/build/test) + deploy Vercel com preview | 19/10 | F2 |
| 3.2 | Landing: hero, sobre, programação (3 dias), palestrantes | 20/10 | F2 |
| 3.3 | Landing: minicursos (vagas), chamada de trabalhos, local, realização/apoio, FAQ, rodapé | 20/10 | F2 |
| 3.4 | Formulário de inscrição (validações, estados de erro/esgotado, upload) | 21/10 | F3 |
| 3.5 | Página de confirmação com comprovante para download | 21/10 | F3 |
| 3.6 | Política de privacidade + termo de consentimento (LGPD) | 23/10 | F4 |
| 3.7 | Acessibilidade WCAG 2.2 AA + Lighthouse ≥ 90 | 23/10 | F4 |

## E4 — Inscrição (MVP)
| # | Tarefa | Data | Fase |
|---|---|---|---|
| 4.1 | Schema + migrations + RLS deny-by-default | 19/10 | F3 |
| 4.2 | RPC `register_participant()` com controle atômico de vagas (ADR-003) | 20/10 | F3 |
| 4.3 | Edge Function `register`: Turnstile, validação CPF/e-mail, rate-limit | 20/10 | F3 |
| 4.4 | Upload do PDF do trabalho: URL assinada, validação `%PDF`/5 MB, janela 25/10–16/11 | 21/10 | F3 |
| 4.5 | Teste de concorrência: N requisições para a última vaga → 1 sucesso | 20/10 | F3 |

## E5 — E-mail e comprovante
| # | Tarefa | Data | Fase |
|---|---|---|---|
| 5.1 | Fila `email_outbox` + `pg_cron` + teto diário + retries + fallback | 21/10 | F3 |
| 5.2 | Comprovante PDF com nº de inscrição e QR assinado (HMAC) | 21/10 | F3 |
| 5.3 | Template de e-mail + anexo `.ics` (3 eventos) + link Google Agenda | 22/10 | F3 |

## E6 — Admin e exportação
| # | Tarefa | Data | Fase |
|---|---|---|---|
| 6.1 | Login por magic link + allowlist de organizadores | 21/10 | F3 |
| 6.2 | Lista, filtros, vagas, status do trabalho, cancelar/corrigir inscrição | 22/10 | F3 |
| 6.3 | Export CSV/XLSX com CPF mascarado e escape de fórmulas | 22/10 | F3 |
| 6.4 | Configuração do evento: vagas dos minicursos, janela de submissão | 22/10 | F3 |

## E7 — Carga, LGPD e operação
| # | Tarefa | Data | Fase |
|---|---|---|---|
| 7.1 | Teste de carga k6 (300 VUs, staging): p95 < 2 s, 0×5xx, sem overbooking | 23/10 | F4 |
| 7.2 | Keep-alive do Supabase + backup agendado (GitHub Actions) | 23/10 | F4 |
| 7.3 | Política de retenção e expurgo de dados | 23/10 | F4 |
| 7.4 | Go-live: freeze, deploy em produção, abertura das inscrições | 25/10 | — |
| 7.5 | Runbook de operação + handover aos stakeholders | 26/10 | — |

## E8 — Segurança (S1–S6)
| # | Tarefa | Data | Fase |
|---|---|---|---|
| 8.1 | Threat model STRIDE + casos de abuso (`docs/seguranca/THREAT-MODEL.md`) | 17/10 | S1 |
| 8.2 | Revisão segura do schema, RLS e fluxos antes de codar | 18/10 | S1 |
| 8.3 | CI: gitleaks + Dependabot | 16/10 | S2 |
| 8.4 | CI: CodeQL + Semgrep (OWASP) + osv-scanner | 19/10 | S2 |
| 8.5 | Testes automatizados: RLS, authz das RPCs admin, Turnstile obrigatório, rate-limit, máscara de CPF, CSV injection, upload | 22/10 | S2 |
| 8.6 | Headers de segurança no Vercel (CSP, HSTS, X-Frame-Options, Referrer-Policy) | 22/10 | S2 |
| 8.7 | DAST: OWASP ZAP baseline + API scan em staging | 24/10 | S3 |
| 8.8 | Pentest manual (OWASP Top 10 / ASVS L1) — relatório `PENTEST-MVP.md` | 24/10 | S3 |
| 8.9 | Correção e reteste dos achados (0 Alto/Crítico para go-live) | 25/10 | S3 |
| 8.10 | Segurança do credenciamento: forja/replay de QR, auth do operador | 30/11 | S4 |
| 8.11 | Segurança dos certificados: enumeração, rate-limit, injeção, vazamento de CPF | antes da liberação | S5 |
| 8.12 | Expurgo LGPD pós-evento, revogação de acessos, rotação de segredos | pós-evento | S6 |

## E9 — Credenciamento QR (pós-MVP)
| # | Tarefa | Fase |
|---|---|---|
| 9.1 | Tabela de presenças + RPC `check_in` idempotente (Dia / Minicurso) | F5 |
| 9.2 | PWA leitor de QR para a organização | F5 |
| 9.3 | Painel de presenças por dia/minicurso | F5 |

## E10 — Certificados (pós-MVP)
| # | Tarefa | Fase |
|---|---|---|
| 10.1 | Cadastro de atividades com carga horária + cálculo de horas por participante | F6 |
| 10.2 | Upload do template PDF + editor de posições (Nome, CPF, Horas) | F6 |
| 10.3 | Geração em lote + fila de envio + botão "Liberar certificados" | F6 |
| 10.4 | Página de download (e-mail + nº de inscrição) + validação pública por código | F6 |
