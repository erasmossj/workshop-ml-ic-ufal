# Plano — Site do I Workshop de Machine Learning (IC/UFAL)

> Realização: Instituto de Computação (IC/UFAL) · IEEE Ramo Estudantil UFAL · IEEE Computer Society UFAL
> Aprovado em 16/10/2026. Entrega do MVP: **26/10/2026**.

## 1. Escopo

### Evento

- Local: exclusivamente no IC/UFAL.

> Atualizado em 16/10 com o relatório de planejamento (reuniões de 02/10 e 15/10). Nome oficial: **IC-ML 2026 — Workshop de Machine Learning do IC**.

- Datas: **02, 03 e 04/12/2026** (qua, qui, sex — o relatório marcava ter–qui por engano). Manhãs: palestras e trabalhos; tardes: minicurso.
- Inscrição padrão = acesso a **todas as palestras** dos 3 dias.
- **Minicurso: 1 minicurso nas 3 tardes** (decidido em 16/10: seguir o relatório), 4 blocos — Fundamentos/Colab, Classificação, Regressão + clustering, Séries temporais. Opt-in na inscrição, vagas limitadas pelo laboratório (número a definir). O schema continua suportando N minicursos, caso mude.
- Site no ar: **26/10**. Inscrições e submissões: **30/10 a 16/11/2026** (prorrogável até 18/11), horário de Maceió, validado no servidor.
- Trabalho: título, autores, resumo e PDF (short paper SBC, 4 ou 6 páginas sem referências). Banca 16/11; avaliação 16–25/11 (**rejeitado / aprovado pôster / aprovado oral**); resultado 26/11.
- Premiação: opt-in para concorrer a **melhor trabalho de graduação** e **de mestrado**.

### MVP (entrega 26/10)

| #     | Requisito                                                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RF01  | Inscrição com **CPF** (validado por dígito verificador), **nome completo** e **e-mail**                                                                                   |
| RF02  | **E-mail único** (case-insensitive); **CPF pode repetir**                                                                                                                 |
| RF03  | Opt-in em cada minicurso; ao esgotar as vagas o sistema **bloqueia** novas inscrições naquele minicurso (sem overbooking sob concorrência)                                |
| RF04  | Mesmo CPF não ocupa duas vagas no mesmo minicurso                                                                                                                         |
| RF05  | Submissão opcional de trabalho: título, autores, resumo, área e **PDF** (≤ 5 MB), só dentro da janela de submissão                                                        |
| RF06  | E-mail de confirmação com nº de inscrição, **comprovante PDF** (com QR assinado), link **Google Agenda** e anexo `.ics` (3 eventos)                                       |
| RF07  | Comprovante também exibido/baixável na tela de confirmação                                                                                                                |
| RF08  | Painel da organização (login por magic link, allowlist): lista, filtros, vagas, status do trabalho (pendente/aceito/rejeitado), cancelar/corrigir inscrição (libera vaga) |
| RF09  | Exportação **CSV e XLSX** com todos os inscritos, minicursos, trabalho, com **CPF mascarado** (`***.456.789-**`) e proteção contra CSV injection                          |
| RNF01 | Suportar **algumas centenas de inscrições simultâneas** (p95 < 2 s, 0 erros 5xx)                                                                                          |
| RNF02 | **Custo zero** (hospedagem, domínio, deploy, manutenção)                                                                                                                  |
| RNF03 | LGPD: consentimento, política de privacidade, mínimo de dados, retenção definida, CPF nunca em logs                                                                       |
| RNF04 | Acessibilidade WCAG 2.2 AA; Lighthouse ≥ 90                                                                                                                               |

### Pós-MVP

- **Credenciamento por QR Code**: 1º scan do dia = presença em todas as palestras do dia; scan no modo "Minicurso" = presença no minicurso.
- **Certificados**: template **PDF** (ver ADR-002) com áreas marcadas para Nome, CPF e Horas; carga horária por atividade cadastrada pela organização; horas calculadas pelo sistema; botão "Liberar" envia por e-mail (fila) + página de download + validação pública.

### Fora de escopo

- Conta/login de participante (decisão do cliente). Correções são feitas pela organização no admin.
- Pagamento, avaliação de trabalhos por pareceristas, notificação de aceite.

## 2. Arquitetura (custo zero) — ver `docs/adr/`

| Camada                       | Escolha                                                                                                                    |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Front-end                    | Astro + Tailwind; ilhas React no formulário e no admin                                                                     |
| Hospedagem/domínio           | **Vercel Hobby** (`*.vercel.app`) — evento acadêmico, não comercial                                                        |
| Banco/Storage/Auth/Functions | **Supabase Free** (projetos `prod` e `staging`)                                                                            |
| Anti-bot                     | Cloudflare Turnstile                                                                                                       |
| E-mail                       | **Gmail do evento** via API/SMTP 465 (~500/dia), fila no banco; Brevo Free (300/dia) como fallback — _validar no spike F0_ |
| PDFs                         | `pdf-lib` em Edge Functions                                                                                                |
| Keep-alive / backup          | GitHub Actions (cron)                                                                                                      |
| Repositório                  | `github.com/erasmossj/workshop-ml-ic-ufal` (público)                                                                       |

## 3. Calendário (início qui 16/10 → entrega antecipada para sex 23/10, com o pós-MVP)

| Data                   | Fase                                      | Entregas                                                                                                                                                                                   | Gate                                  |
| ---------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------- |
| **16/10 (qui)**        | **F0 Setup e governança**                 | Repo público, `CLAUDE.md`, plano/ADRs, CI de segurança base, projeto Jira `WML`, espaço Confluence `WML`                                                                                   | —                                     |
| **17/10 (sex)**        | **F1 Design** · **S1 Threat model**       | Pesquisa de referências, moodboard, **5 protótipos Figma** (A–E); STRIDE + casos de abuso                                                                                                  | —                                     |
| **18/10 (sáb)**        | F1 gate · S1 revisão                      | Stakeholders escolhem a direção; revisão segura do schema/RLS/fluxos                                                                                                                       | ✅ **Direção visual escolhida**       |
| **19–22/10 (dom–qua)** | **F2+F3 MVP** · **S2 Segurança contínua** | Front da direção escolhida + backend (schema, RPC de vagas, Edge Functions, upload, e-mail, admin, export); SAST/SCA/secrets no CI; testes de segurança automatizados escritos junto (TDD) | CI verde em todo PR                   |
| **23/10 (qui)**        | **F4 Carga e LGPD**                       | k6 300 VUs em staging; política de privacidade; retenção; keep-alive; backup                                                                                                               | ✅ RNF01 atingido                     |
| **24/10 (sex)**        | **S3 Pentest / DAST**                     | OWASP ZAP (baseline + API) + checklist manual ASVS L1 em staging                                                                                                                           | —                                     |
| **25/10 (sáb)**        | S3 correções · Go-live                    | Correção de achados, reteste, freeze, deploy em produção, abertura das inscrições/submissões                                                                                               | ✅ **0 achados Alto/Crítico abertos** |
| **20–21/10 (ter–qua)** | F5 Credenciamento QR · **S4** (adiantado) | PWA leitor, RPC de check-in, painel de presenças; testes de forja/replay de QR ([ADR-004](adr/ADR-004-credenciamento-qr.md))                                                               | CI verde                              |
| **22–23/10 (qui–sex)** | F6 Certificados · **S5** (adiantado)      | Carga horária, editor de template, liberação em fila, download e validação; testes de enumeração ([ADR-005](adr/ADR-005-certificados-sob-demanda.md)); automação do expurgo (S6)           | CI verde                              |
| **23/10 (sex)**        | **Entrega** (antecipada de 26/10)         | Apresentação aos stakeholders **no staging** com dados sintéticos: MVP + credenciamento + certificados; handover, runbook                                                                  | ✅ **Entrega**                        |
| 26/10–29/10            | Ajustes do feedback                       | Alterações pedidas na apresentação, priorizadas no Jira                                                                                                                                    | antes da abertura (30/10)             |
| 03–05/12               | Evento                                    | Credenciamento em operação                                                                                                                                                                 | —                                     |
| pós-evento             | Liberação de certificados · **S6**        | Envio em fila; limpeza LGPD (PDFs, CPFs) após prazo de retenção                                                                                                                            | —                                     |

> Contingência: se o gate de 18/10 atrasar, publica-se página "em breve" com o formulário funcional no visual da direção mais votada e o refinamento visual segue depois do go-live.

## 4. Fases

### F0 — Setup e governança (16/10)

Repo, `CLAUDE.md`, plano, ADRs, Dependabot + gitleaks no CI, Jira/Confluence, **spike de e-mail** (Gmail do evento: limite real, envio a partir de Edge Function, entregabilidade).

### F1 — Pesquisa e 5 protótipos Figma (17–18/10)

Referências: NeurIPS/ICML, Google I/O, Config, PyCon/Python Brasil, TDC, LatinX in AI, padrões de formulário Sympla/Even3. Marcas: IC/UFAL, IEEE CS (laranja + azul, Montserrat/Open Sans), IEEE RE UFAL (placeholder até a diretoria enviar).

1 arquivo Figma, 5 páginas — cada uma com Landing + Formulário + Confirmação, desktop e mobile:

| #   | Direção                 | Ideia                                                       |
| --- | ----------------------- | ----------------------------------------------------------- |
| A   | Institucional acadêmica | IC/UFAL dominante, sóbrio                                   |
| B   | Neural / dark tech      | grafos de rede neural, acento laranja IEEE CS               |
| C   | Editorial bold          | tipografia grande, grid assimétrico                         |
| D   | Gradiente moderno       | glass + gradientes azul IEEE / cores IC                     |
| E   | Conversão primeiro      | landing curta, formulário acima da dobra, contador de vagas |

Seções: hero (data + CTA), sobre, programação (3 dias), palestrantes, minicursos (vagas), chamada de trabalhos, local/mapa, realização e apoio, FAQ, rodapé.

### F2+F3 — MVP codificado (19–22/10)

1. Scaffold Astro + Tailwind + tokens de marca; deploy Vercel com preview por PR.
2. Migrations: `participantes`, `minicursos`, `inscricoes_minicurso`, `trabalhos`, `atividades`, `email_outbox`, `organizadores`, `config_evento`; RLS deny-by-default.
3. RPC `register_participant()` transacional (ver ADR-003).
4. Edge Function `register`: Turnstile, validação, rate-limit, RPC, URL assinada de upload.
5. Edge Function `send-emails` + `pg_cron`: fila com teto diário e retries; comprovante PDF + `.ics` + link Google Agenda.
6. Admin `/admin`: magic link + allowlist; lista/filtros/vagas/status de trabalho/cancelar; export CSV/XLSX mascarado.
7. Testes: unitários (CPF, máscara, escape CSV), integração (concorrência de vagas, RLS), E2E Playwright.

### F4 — Carga e LGPD (23/10)

k6 com 300 VUs em ~1 min contra **staging** (critérios: p95 < 2 s, 0×5xx, `ocupadas ≤ vagas`). Política de privacidade, termo de consentimento, retenção, keep-alive, backup agendado.

### F5 — Credenciamento QR (pós-MVP, adiantado para 20–21/10)

QR = código de inscrição + HMAC. PWA leitor (BarcodeDetector / `qr-scanner`), modos **Dia** e **Minicurso**, RPC `check_in` idempotente, feedback visual/sonoro, busca manual pelo número. Leitor só online; operadores = organizadores ([ADR-004](adr/ADR-004-credenciamento-qr.md)).

### F6 — Certificados (pós-MVP, adiantado para 22–23/10)

Cadastro de atividades (dia, tipo, carga horária) → horas = palestras dos dias com presença + minicursos com presença. Editor pdf.js para posicionar Nome/CPF/Horas. "Liberar" congela as horas e enfileira e-mails; página de download (e-mail + nº inscrição); código de validação público aleatório. PDF gerado sob demanda, sem guardar no Storage ([ADR-005](adr/ADR-005-certificados-sob-demanda.md)).

## 5. Fases de testes de segurança

| Fase                                     | Quando             | O quê                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Critério de saída                                                                           |
| ---------------------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| **S1 — Threat modeling e design seguro** | 17–18/10           | STRIDE sobre os fluxos (inscrição, upload, e-mail, admin, export); inventário de ativos (CPF, e-mail, PDFs, vagas); casos de abuso; revisão do schema/RLS antes de codar                                                                                                                                                                                                                                                                                                                       | `docs/seguranca/THREAT-MODEL.md` com cada mitigação mapeada a uma task Jira                 |
| **S2 — Segurança contínua (shift-left)** | 19–25/10, todo PR  | **CI**: gitleaks (secrets), CodeQL + Semgrep (SAST, regras OWASP), `npm audit`/osv-scanner (SCA), Dependabot, `supabase db lint`. **Testes automatizados**: anon não lê/escreve tabelas (RLS); RPC admin nega não-organizador; inscrição sem Turnstile é rejeitada; rate-limit; CPF nunca sai sem máscara; escape de CSV injection (`= + - @`); upload rejeita não-PDF/arquivo > 5 MB; janela de submissão respeitada                                                                          | Pipeline verde; 0 Alto/Crítico em SAST/SCA                                                  |
| **S3 — Pentest / DAST pré-lançamento**   | 24–25/10           | OWASP ZAP baseline + API scan em staging. Checklist manual (OWASP Top 10 / ASVS L1): bypass da Edge Function chamando PostgREST direto com a anon key; IDOR em caminhos do Storage e expiração de URL assinada; adulteração de JWT; race condition de vagas (rajada concorrente); enumeração de e-mail; XSS em nome/título renderizados no admin e no PDF; PDF malicioso (JS embutido, polyglot); headers (CSP, HSTS, X-Frame-Options); allowlist do magic link; segredos no bundle do cliente | Relatório em `docs/seguranca/PENTEST-MVP.md`; **0 achados Alto/Crítico abertos** no go-live |
| **S4 — Segurança do credenciamento**     | até 30/11          | Forja e replay de QR, check-in duplicado, autenticação do operador, uso do leitor offline                                                                                                                                                                                                                                                                                                                                                                                                      | 0 Alto/Crítico                                                                              |
| **S5 — Segurança dos certificados**      | antes da liberação | Enumeração na página de download/validação, rate-limit, injeção no template, integridade do PDF, vazamento de CPF                                                                                                                                                                                                                                                                                                                                                                              | 0 Alto/Crítico                                                                              |
| **S6 — LGPD pós-evento**                 | após certificados  | Expurgo de PDFs e CPFs conforme retenção; revogação de acessos de organizadores; rotação de segredos                                                                                                                                                                                                                                                                                                                                                                                           | Checklist concluído                                                                         |

## 6. Épicos Jira (projeto `WML`)

E1 Setup e governança · E2 Design e protótipos · E3 Front-end do site · E4 Inscrição (MVP) · E5 E-mail e comprovante · E6 Admin e exportação · E7 Carga, LGPD e operação · **E8 Segurança (S1–S6)** · E9 Credenciamento QR · E10 Certificados.
Backlog detalhado: `docs/BACKLOG.md`.

## 7. Riscos

| Risco                                               | Nível | Mitigação                                                                                     |
| --------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------- |
| Prazo de 10 dias para design + MVP + segurança      | ALTO  | Protótipo codificado = MVP; gate rápido em 18/10; contingência "em breve"                     |
| Supabase Free pausa após 7 dias sem uso             | ALTO  | Keep-alive via GitHub Actions; monitorar antes da abertura                                    |
| Teto diário de e-mail estourar no pico/certificados | ALTO  | Fila escalonada; comprovante/certificado também na tela/portal; provedor de fallback          |
| E-mails em spam (sem domínio próprio)               | ALTO  | Enviar pelo próprio Gmail do evento; orientar participante a checar spam; texto simples + PDF |
| Storage de 1 GB                                     | MÉDIO | Limite 5 MB/PDF; alerta de cota; expurgo pós-evento                                           |
| Vagas dos minicursos ainda indefinidas              | MÉDIO | Configuráveis no admin; minicurso fica "em breve" até definir                                 |
| Elementos do IEEE RE UFAL pendentes                 | MÉDIO | Tokens de marca + placeholders                                                                |
| LGPD (CPF)                                          | MÉDIO | Máscara, RLS, consentimento, retenção, sem CPF em logs                                        |
| Reinscrição com outro e-mail                        | BAIXO | Unicidade (CPF, minicurso) + correção pela organização no admin                               |
