# CLAUDE.md — Site do I Workshop de Machine Learning (IC/UFAL)

Guia para agentes (Claude Code e similares) que trabalham neste repositório. Leia inteiro antes de qualquer alteração.

## Contexto

Site de divulgação **e** inscrição do **I Workshop de Machine Learning do IC/UFAL**, realizado pelo Instituto de Computação (IC/UFAL), IEEE Ramo Estudantil UFAL e IEEE Computer Society UFAL.

- Evento: 3 dias (03–05/12/2026), no IC/UFAL. Inscrição padrão dá acesso a todas as palestras; 2 minicursos opcionais com vagas limitadas.
- Submissão de trabalhos (PDF): 25/10–16/11/2026, horário `America/Maceio`.
- Entrega do MVP: **26/10/2026**. Plano completo, calendário e fases de segurança: [`docs/PLANO.md`](docs/PLANO.md). Decisões: [`docs/adr/`](docs/adr/).
- Público: participantes (sem conta/login) e organização (painel `/admin`).

## Regras invioláveis

1. **Custo zero.** Não adicione serviço, dependência ou plano pago. Tudo deve caber nos planos gratuitos (Vercel Hobby, Supabase Free, Turnstile, Gmail/Brevo Free, GitHub Actions). Na dúvida, pergunte.
2. **CPF é dado pessoal (LGPD).**
   - Nunca registre CPF, e-mail ou nome em logs, mensagens de erro, analytics ou commits.
   - CPF sai do banco **somente mascarado** (`***.456.789-**`), exceto dentro de Edge Functions que geram comprovante/certificado.
   - Nunca use dados reais em testes, fixtures, seeds ou screenshots — use CPFs sintéticos válidos.
3. **Vagas de minicurso só via RPC `register_participant()` / `cancel_registration()`.** Nunca atualize `minicursos.ocupadas` em outro lugar; a atomicidade (ADR-003) é o que impede overbooking.
4. **RLS deny-by-default.** Toda tabela nova nasce com RLS habilitado e sem policy para `anon`. Escrita pública só passa pela Edge Function `register` (Turnstile + validação + rate-limit).
5. **Segredos** (service role, chaves Turnstile/Gmail/HMAC) só em variáveis de ambiente do Supabase/Vercel/GitHub. Nada de segredo no código do cliente (`PUBLIC_*` só para valores realmente públicos).
6. **E-mail único, CPF repetível.** Unicidade em `lower(trim(email))`; unicidade em `(cpf, minicurso_id)` nas inscrições de minicurso.
7. **Datas/horas** sempre em `America/Maceio` na interface e validadas no servidor.
8. **Interface em PT-BR**, linguagem simples, acessível (WCAG 2.2 AA).

## Stack

| Camada | Tecnologia |
|---|---|
| Front-end | Astro + Tailwind CSS; ilhas React (formulário, admin) |
| Hospedagem | Vercel Hobby (`*.vercel.app`), preview por PR |
| Backend | Supabase: Postgres + RLS, Storage (bucket privado `trabalhos`), Auth (magic link da organização), Edge Functions (Deno), `pg_cron` |
| Anti-bot | Cloudflare Turnstile |
| E-mail | Gmail do evento (API/SMTP 465) com fila `email_outbox`; Brevo como fallback |
| PDF | `pdf-lib` (comprovante, certificado) |
| Testes | Vitest (unit), pgTAP (banco/RLS), Playwright (E2E), k6 (carga) |

## Estrutura (alvo)

```
src/                 # site Astro (pages, components, layouts, styles/tokens)
src/pages/admin/     # painel da organização
supabase/migrations/ # SQL versionado — única fonte do schema
supabase/functions/  # Edge Functions (register, send-emails, ...)
supabase/tests/      # pgTAP (RLS, RPCs, concorrência)
e2e/                 # Playwright
load/                # scripts k6
docs/                # PLANO, ADRs, BACKLOG, seguranca/, marca/
```

## Comandos

> Serão confirmados no scaffold (F2). Mantenha esta seção atualizada.

```bash
npm run dev            # site local
npm run build          # build de produção
npm run lint           # ESLint + Prettier
npm test               # Vitest
npm run test:e2e       # Playwright
supabase start         # stack local (Docker)
supabase db reset      # recria banco local com migrations + seed sintético
supabase test db       # pgTAP
k6 run load/inscricao.js   # carga — SOMENTE contra staging, nunca produção
```

## Fluxo de trabalho

- **Jira**: projeto `WML` em `erasmojunior.atlassian.net` (nunca use outro site Atlassian). Cada branch/PR referencia uma issue.
- **Branches**: `feat/WML-<n>-<slug>`, `fix/…`, `docs/…`, `sec/…`. Nunca commit direto em `main`.
- **Commits**: Conventional Commits em PT-BR, com a issue no final: `feat: bloqueia minicurso esgotado (WML-23)`.
- **PR**: descrição com o que mudou, como testar e checklist de segurança/LGPD. CI verde é obrigatório.
- **Status Jira**: A fazer → Em andamento → **Em análise** → Concluído. Itens feitos por IA param em "Em análise" até revisão humana.
- **Confluence**: espaço `WML` espelha `docs/`. Ao mudar uma decisão, atualize o ADR no repo e a página correspondente.

## Definition of Done

- [ ] Critérios de aceite da issue atendidos.
- [ ] Testes escritos primeiro (TDD) e passando; cobertura ≥ 80% no código novo de domínio.
- [ ] Mudança de schema tem migration + teste pgTAP de RLS.
- [ ] Nenhum dado pessoal em logs/fixtures; CPF mascarado em qualquer saída.
- [ ] Lint, build, CI de segurança (gitleaks, CodeQL/Semgrep, SCA) verdes.
- [ ] Acessível (teclado, contraste, labels) e responsivo (360 px+).
- [ ] Docs/ADR atualizados quando a decisão mudar.

## Segurança — checklist para todo PR

- Entrada validada no servidor (não confie no front): CPF (dígito verificador), e-mail, tamanhos, janela de submissão.
- Upload: só PDF (verificar assinatura `%PDF`, não só extensão), ≤ 5 MB, caminho gerado pelo servidor (UUID), bucket privado, URL assinada curta.
- Saída: escape de HTML; export CSV/XLSX com escape de fórmulas (`= + - @` no início da célula).
- RPCs administrativas verificam `organizadores` via `auth.uid()`.
- Fases de teste de segurança S1–S6: ver `docs/PLANO.md` §5. Achados vão para `docs/seguranca/`.

## Marca e design

- Fontes de marca: IC/UFAL, IEEE Computer Society (laranja + azul; Montserrat / Open Sans), IEEE RE UFAL (**pendente** — usar placeholders até a diretoria enviar).
- Cores e fontes só via tokens (`src/styles/tokens.css` / `tailwind.config`) — nunca hex solto em componente.
- Protótipos Figma e direção escolhida: `docs/marca/` e página "Design" no Confluence.
- Respeite as regras de uso de logo de cada organização (área de proteção, versões permitidas).

## O que NÃO fazer

- Não criar login/conta para participante (fora de escopo por decisão do cliente).
- Não rodar teste de carga ou scanner (ZAP) contra produção.
- Não usar DOCX para certificados (ADR-002).
- Não alterar `main` sem PR; não usar `--no-verify`.
- Não publicar planilhas exportadas, PDFs de participantes ou dumps no repositório (está no `.gitignore`, mas verifique).
