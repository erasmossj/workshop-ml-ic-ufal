# LGPD pós-evento (S6) — IC-ML 2026

> WML-52. Expurgo automático nas datas da política de privacidade, revogação de acessos e rotação
> de segredos. A automação fica pronta e testada agora; a execução acontece depois do evento.
> Critério de saída: **checklist concluído**.

## Expurgo automático (pronto)

Todo dia às 03:50 de Maceió, o `pg_cron` chama `disparar_expurgo()`. Só se houver algo vencido, a
função acorda a Edge Function `expurgo` (mesmo segredo de cron da fila de e-mail, sem
configuração nova). Prazos em `config_evento`, iguais aos de `privacidade.retencao` em
`src/data/evento.ts` — o teste `src/data/retencao.test.ts` quebra se um mudar sem o outro.

| A partir de | O que é apagado                                                                                                         | Como                                                          |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 01/02/2027  | PDFs dos trabalhos                                                                                                      | API do Storage (o arquivo de fato), depois o caminho no banco |
| 01/04/2027  | CPF, e-mail e instituição; CPF das vagas do minicurso; fila de e-mail; limites por IP; e-mail do operador nas presenças | Banco (`expurgar_dados`)                                      |
| 01/01/2032  | Inscrições restantes (nome, nº, presenças, emissão do certificado) — a validação pública por código deixa de responder  | Banco (`expurgar_dados`)                                      |

Depois de 01/04/2027 o download do certificado deixa de existir (não há mais e-mail para conferir);
a validação por código continua até 31/12/2031, sem CPF.

**Evidência**: `supabase/tests/database/expurgo.test.sql` (24 casos: antes/depois de cada prazo,
idempotência, privilégios), `supabase/functions/_shared/expurgo.test.ts` (lotes, só marca o que saiu
do Storage, ordem arquivos → dados) e `tests/integracao/expurgo.test.ts` (segredo do cron; nada
apagado antes dos prazos).

Backups: o artifact diário some sozinho em 14 dias — nenhum backup sobrevive aos prazos.

## Checklist depois da liberação dos certificados

Responsável técnico, com a organização. Marque e registre a data.

- [ ] **Revogar acessos**: apagar os e-mails de `organizadores` (SQL Editor) e as contas em
      Supabase → Authentication → Users. Manter só quem cuida das dúvidas de certificado até 31/03/2027.
- [ ] **Rotacionar a chave de serviço** do Supabase (Project Settings → API Keys / JWT) e atualizar
      os segredos que a usam (GitHub Actions, se houver).
- [ ] **Senha de app do Gmail**: revogar em myaccount.google.com/apppasswords e criar outra só se
      o envio ainda for necessário.
- [ ] **Brevo**: revogar a chave da API.
- [ ] **Turnstile**: rotacionar a chave secreta (dash.cloudflare.com) e atualizar `TURNSTILE_SECRET_KEY`.
- [ ] **QR_HMAC_SECRET**: rotacionar (os QR dos comprovantes deixam de valer — não há mais
      credenciamento).
- [ ] **SEND_EMAILS_SECRET**: rotacionar **junto** com o Vault (`send_emails_secret`), senão a fila e
      o expurgo param.
- [ ] **Vercel**: revogar o `VERCEL_AUTOMATION_BYPASS_SECRET` (e o secret do GitHub).
- [ ] **Chave do backup** (`icml-backup.key`): apagar depois de 14 dias sem backup novo.
- [ ] **Planilhas exportadas** e PDFs baixados no computador da organização: apagar.
- [ ] Conferir em 01/02/2027 e 01/04/2027 que o expurgo rodou (Supabase → Edge Functions → `expurgo`
      → Logs: contagens, sem dado pessoal).
