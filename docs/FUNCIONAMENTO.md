# Como o sistema funciona — IC-ML 2026

> Visão ponto a ponto, para a organização e para quem for manter o site. Espelhado no Confluence
> (espaço `WML`). Decisões em [`adr/`](adr/), operação em [`RUNBOOK.md`](RUNBOOK.md), plano e
> calendário em [`PLANO.md`](PLANO.md).

## Em uma frase

Um site estático (Astro, na Vercel) divulga o evento e recebe as inscrições. Cada inscrição passa por
uma única porta de escrita — a Edge Function `register` no Supabase —, que valida tudo, grava no
banco numa transação (sem estourar vagas) e coloca o e-mail de confirmação numa fila. A organização
acompanha tudo pelo painel `/admin`. Custo: zero (só planos gratuitos, [ADR-001](adr/ADR-001-stack-custo-zero.md)).

## Arquitetura

```
 Participante (navegador)                     Organização (navegador)
        │                                              │
        ▼                                              ▼
 ┌──────────────────────────── Vercel (site Astro, HTTPS, CSP) ────────────────────────────┐
 │  /            divulgação (conteúdo de src/data/evento.ts)                                │
 │  /inscricao   formulário + Cloudflare Turnstile                                         │
 │  /confirmacao resumo da inscrição                    /admin  painel (login por link)    │
 │  /privacidade política de privacidade (LGPD)                                            │
 └──────┬───────────────────────────────────────────────────────────────┬─────────────────┘
        │ POST multipart (dados + PDF)                                  │ RPCs com login
        ▼                                                               ▼
 ┌──────────────────────────────────── Supabase ───────────────────────────────────────────┐
 │  Edge Function register ──► Postgres (RLS: ninguém lê/escreve tabela direto)            │
 │    limite por origem         register_participant()  → inscrição + vaga, 1 transação   │
 │    Turnstile                 admin_*()               → só quem está em organizadores    │
 │    validação + PDF ─────────► Storage (bucket privado "trabalhos")                      │
 │                                                                                         │
 │  pg_cron (a cada minuto) ──► Edge Function send-emails ──► Gmail (SMTP) / Brevo         │
 │                              comprovante PDF + QR assinado + .ics                       │
 └─────────────────────────────────────────────────────────────────────────────────────────┘
 GitHub Actions: CI de qualidade e segurança em todo PR · keep-alive diário · backup diário criptografado
```

| Camada     | Tecnologia                                                                            |
| ---------- | ------------------------------------------------------------------------------------- |
| Site       | Astro + Tailwind; ilhas de script no formulário e no painel                           |
| Hospedagem | Vercel Hobby (`*.vercel.app`), preview automático por PR                              |
| Backend    | Supabase Free: Postgres + RLS, Storage, Auth (link mágico), Edge Functions, `pg_cron` |
| Anti-robô  | Cloudflare Turnstile                                                                  |
| E-mail     | Gmail do evento (SMTP 465), Brevo como reserva                                        |
| PDF        | `pdf-lib` (comprovante; certificados no pós-MVP)                                      |

**Ambientes:** produção (branch `main` → Vercel produção + Supabase prod), staging (Supabase staging,
usado em teste de carga e pentest) e local (`supabase start`, Docker). Cada PR ganha um preview na Vercel.

## 1. Inscrição, passo a passo

1. **Formulário** (`/inscricao`): nome, CPF, e-mail, instituição (opcional), minicurso (opcional),
   trabalho (opcional: título, autores, resumo, PDF, prêmio) e aceite da política de privacidade. O
   navegador já valida (CPF com dígito verificador, e-mail, tamanhos), mas o servidor valida de novo.
2. **Turnstile** gera um token provando que não é robô.
3. O navegador envia tudo para a Edge Function **`register`**, que segue esta ordem:
   1. **Limite por origem**: conta toda tentativa por IP (guardado só como hash). Passou do limite
      (padrão 10 em 10 minutos) → 429.
   2. **Turnstile** validado com a Cloudflare → sem token válido, 403.
   3. **Consentimento** obrigatório → sem aceite, 422.
   4. **PDF** (se houver trabalho): até 5 MB (senão 413) e assinatura `%PDF` no conteúdo, não só a
      extensão (senão 422).
   5. **Upload** do PDF para o bucket privado com nome gerado pelo servidor (UUID).
   6. **`register_participant()`** no banco, numa transação única: confere a janela de inscrição,
      valida e normaliza os dados, garante e-mail único e reserva a vaga do minicurso.
   7. Se o banco recusar (e-mail repetido, vaga esgotada, fora da janela...), o PDF enviado é apagado
      e o participante recebe a mensagem e o campo do erro.
4. **Resposta**: só o número de inscrição (`ICML26-0001`). Nenhum dado pessoal volta.
5. **Confirmação** (`/confirmacao`): mostra o resumo com o que a pessoa digitou (guardado só na aba do
   navegador), CPF mascarado e botões de imprimir e adicionar à agenda (`.ics`).
6. **E-mail de confirmação**: a inscrição entra na fila `email_outbox` na mesma transação (ver §3).

## 2. Vagas do minicurso sem overbooking

[ADR-003](adr/ADR-003-controle-de-vagas.md). A vaga é reservada com um `UPDATE` condicional
(`ocupadas < vagas`) dentro da transação da inscrição, e uma restrição do banco (`ocupadas <= vagas`)
é a última defesa. Testado com 100–120 inscrições simultâneas pela última vaga: 1 sucesso, o resto
recebe "esgotado". Vagas só mudam pelas RPCs `register_participant()`, `cancel_registration()` e
`admin_definir_vagas()` (que não deixa reduzir abaixo das ocupadas). O mesmo CPF não ocupa duas vagas.

## 3. E-mail de confirmação

1. O `pg_cron` chama a função **`send-emails`** a cada minuto, com um segredo próprio.
2. Ela reserva um lote da fila respeitando o **teto diário** (padrão 450/dia, ajustável no painel)
   — o limite do Gmail gratuito é ~500.
3. Para cada item, monta o e-mail com:
   - **comprovante em PDF** com número de inscrição, dados (CPF mascarado) e **QR Code assinado**
     (HMAC do número — servirá no credenciamento sem expor dado pessoal);
   - **`.ics`** com os 3 dias do evento e link para o Google Agenda.
4. Envia pelo **Gmail**; se falhar, tenta pelo **Brevo**. Falhou nos dois → nova tentativa com espera
   crescente (2, 4, 8... minutos), até 5 vezes; depois fica como "falhou" no painel.
5. A mensagem de erro guardada passa por um filtro que remove e-mail e CPF.

## 4. Painel da organização (`/admin`)

- **Login** por link mágico no e-mail; só entra quem está na tabela `organizadores` (allowlist).
  Pedir link com e-mail desconhecido não cria conta.
- **Lista** de inscrições com busca (nome sem acento, e-mail ou número), filtros (minicurso, trabalho,
  situação) e paginação. **CPF sempre mascarado**.
- **Ações**: cancelar (libera a vaga), corrigir dados, reenviar confirmação, definir o status do
  trabalho (pendente, aprovado oral, aprovado pôster, rejeitado), abrir o PDF por **URL assinada curta**.
- **Configuração**: vagas do minicurso, janelas de inscrição e submissão, teto diário de e-mail;
  resumo da fila de e-mail.
- **Exportar CSV** da lista filtrada: CPF mascarado, datas de Maceió e escape de fórmulas
  (`= + - @`) contra injeção em planilha.
- Toda RPC do painel confere `organizadores` no próprio banco — esconder botão na tela não é a proteção.

## 5. Segurança e LGPD (resumo)

- **RLS em todas as tabelas**, sem acesso direto para visitantes nem usuários logados; o público só
  executa `vagas_publicas()`. Um teste fixa essa lista (função nova exposta quebra o CI).
- **CPF**: só sai do banco mascarado (`***.456.789-**`), nunca em logs; teste estático nos logs.
- **Segredos** só nas variáveis de ambiente do Supabase, Vercel e GitHub.
- **Headers**: CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- **Política de privacidade** com prazos de retenção (`/privacidade`); expurgo depois do evento (S6).
- Detalhes: [`seguranca/THREAT-MODEL.md`](seguranca/THREAT-MODEL.md) e fases S1–S6 no
  [`PLANO.md`](PLANO.md#5-fases-de-testes-de-segurança).

## 6. Operação

- **Keep-alive** diário (o Supabase Free pausa após 7 dias sem uso) e **backup** diário do banco de
  produção, criptografado com a chave da organização, guardado por 14 dias.
- Passo a passo (trocar Gmail, restaurar backup, teste de carga, retenção): [`RUNBOOK.md`](RUNBOOK.md).

## 7. Qualidade e entrega

- Todo PR roda: `astro check`, ESLint, Prettier, Vitest, build, Lighthouse, Playwright (com axe
  WCAG 2.2 AA e CSP), pgTAP, teste de concorrência, integração HTTP das Edge Functions, gitleaks,
  CodeQL, Semgrep e `npm audit`. Sem CI verde, sem merge.
- Teste de carga (k6, só staging): 300 inscrições em ~1 min com p95 < 2 s, 0 erros 5xx e sem overbooking.

## 8. Depois do MVP

- **Credenciamento por QR** (F5): leitor PWA para a organização, check-in por dia e minicurso
  ([ADR-004](adr/ADR-004-credenciamento-qr.md)).
- **Certificados** (F6): template em PDF com posições de Nome, CPF e Horas
  ([ADR-002](adr/ADR-002-certificado-pdf.md)), geração sob demanda, download e validação pública por
  código ([ADR-005](adr/ADR-005-certificados-sob-demanda.md)).
