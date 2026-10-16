# ADR-001 — Stack de custo zero

- Status: Aceito (16/10/2026)
- Contexto: o site precisa de divulgação + inscrição de algumas centenas de pessoas simultâneas, upload de PDF, e-mail transacional e painel da organização, **sem custo** de hospedagem, domínio, deploy ou manutenção. Não há domínio próprio nem subdomínio institucional disponível.

## Decisão

| Necessidade                     | Escolha                                                     | Limites gratuitos relevantes                                                                                  |
| ------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Site estático + CDN             | **Astro** em **Vercel Hobby** (`*.vercel.app`)              | Uso não comercial (evento acadêmico)                                                                          |
| Banco, Storage, Auth, Functions | **Supabase Free**                                           | 500 MB Postgres, 1 GB Storage, 5 GB egress, 500 mil invocações/mês, 2 projetos; **pausa após 7 dias sem uso** |
| Anti-bot                        | **Cloudflare Turnstile**                                    | Gratuito                                                                                                      |
| E-mail transacional             | **Gmail do evento** (API/SMTP 465), fallback **Brevo Free** | Gmail ~500/dia (a validar); Brevo 300/dia                                                                     |
| CI, keep-alive, backup          | **GitHub Actions** (repo público)                           | Minutos ilimitados em repo público                                                                            |

## Alternativas consideradas

- **Cloudflare Pages + Workers + D1 + R2**: não pausa e tem limites generosos, mas exigiria construir auth/admin do zero; R2 pede cartão cadastrado.
- **Firebase Spark**: Cloud Storage passou a exigir plano Blaze.
- **Resend Free**: 100 e-mails/dia — insuficiente para o pico.

## Consequências

- Keep-alive diário obrigatório (GitHub Actions) para o Supabase não pausar.
- E-mail tem teto diário → fila `email_outbox` com envio escalonado; comprovante também disponível na tela.
- Sem domínio próprio, não há SPF/DKIM próprios: enviar pelo próprio Gmail reduz risco de spam.
- Limite de 5 MB por PDF para caber em 1 GB.
