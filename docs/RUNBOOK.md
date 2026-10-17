# Runbook de operação — IC-ML 2026

> Procedimentos da organização. Completado na entrega (WML-40). Nunca cole senha, chave secreta,
> CPF ou e-mail de participante em issue, PR, chat ou commit.

## ⚠️ Pendências de configuração

| Pendência                   | Desde      | Situação                                                                                                                                                      |
| --------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gmail oficial do evento** | 16/10/2026 | A produção envia pelo **Gmail de testes** (o mesmo do staging) porque o e-mail oficial ainda não existe. Trocar **antes de 30/10** (abertura das inscrições). |

### Trocar o Gmail de envio (quando o oficial existir)

1. Na conta nova: ative a verificação em duas etapas e gere uma **senha de app**
   (myaccount.google.com/apppasswords, 16 letras).
2. Num PowerShell (fora do chat), crie o arquivo temporário `notepad $HOME\icml-gmail.env` com:
   ```
   GMAIL_USER=<gmail oficial>
   GMAIL_APP_PASSWORD=<senha de app>
   ```
3. Envie para a produção e apague o arquivo:
   ```powershell
   npx supabase secrets set --project-ref sjzyipebykiaiasdafai --env-file $HOME\icml-gmail.env
   Remove-Item $HOME\icml-gmail.env
   ```
   Não precisa publicar a função de novo nem mexer no Vault: os segredos valem na próxima execução.
   **Não** altere `QR_HMAC_SECRET` nem `SEND_EMAILS_SECRET`.
4. Se o SMTP do login do painel (Authentication → Emails → SMTP Settings) foi configurado com o
   Gmail de testes, troque lá também.
5. Teste: uma inscrição real com e-mail da organização (`nome+teste@...`) e confira a chegada;
   depois cancele no `/admin`.
6. Remova esta linha da tabela de pendências.

## Keep-alive e backup (WML-37)

O workflow `.github/workflows/operacao.yml` roda todo dia:

- **Keep-alive** (09:17 de Maceió): uma consulta pública (vagas) no prod e no staging. O Supabase
  Free pausa o projeto após 7 dias sem uso; isso evita a pausa.
- **Backup** (03:37 de Maceió): dump do banco de produção, **criptografado** com a chave da
  organização, guardado como artifact por 14 dias. Sem a chave privada ninguém abre o arquivo — o
  repositório é público.

Falhas chegam por e-mail do GitHub para quem administra o repositório.

> O GitHub desliga agendamentos de repositórios públicos após 60 dias sem commits. Até o fim do
> evento isso não acontece; depois, reative em Actions → operacao → Enable workflow, se precisar.

### Configuração (uma vez)

Em **GitHub → repositório → Settings → Secrets and variables → Actions**:

1. **Chave do backup** (no seu computador, com [age](https://github.com/FiloSottile/age/releases)):

   ```bash
   age-keygen -o icml-backup.key   # imprime "Public key: age1..."
   ```

   Guarde `icml-backup.key` fora do repositório (gerenciador de senhas ou pendrive da organização).
   Perdeu a chave = perdeu os backups.

2. Aba **Variables** → _New repository variable_:

   | Nome                        | Valor                                                                   |
   | --------------------------- | ----------------------------------------------------------------------- |
   | `BACKUP_AGE_RECIPIENT`      | a linha `age1...` (chave **pública**)                                   |
   | `SUPABASE_URL_PROD`         | `https://<ref-prod>.supabase.co`                                        |
   | `SUPABASE_ANON_KEY_PROD`    | chave anon/publishable do prod (Supabase → Project Settings → API Keys) |
   | `SUPABASE_URL_STAGING`      | `https://<ref-staging>.supabase.co`                                     |
   | `SUPABASE_ANON_KEY_STAGING` | chave anon/publishable do staging                                       |

3. Aba **Secrets** → _New repository secret_:
   - `SUPABASE_DB_URL_PROD`: Supabase (prod) → botão **Connect** → **Session pooler** → copie a
     URI e troque `[YOUR-PASSWORD]` pela senha do banco. Nunca use a do staging aqui.

4. Teste: **Actions → operacao → Run workflow**. Os três jobs devem ficar verdes e o artifact
   `backup-prod` aparecer no resumo da execução.

### Restaurar um backup

1. Baixe o artifact `backup-prod` da execução desejada (Actions → operacao) e extraia o `.zip`.
2. Descriptografe e abra:
   ```bash
   age -d -i icml-backup.key backup-AAAAMMDDTHHMMZ.tar.gz.age | tar -xzf -
   # gera schema.sql e dados.sql
   ```
3. Restaure **num projeto vazio** (ou no local, para conferir antes):
   ```bash
   psql "<URI do banco de destino>" -f schema.sql
   psql "<URI do banco de destino>" -f dados.sql
   ```
4. Apague os `.sql` descriptografados ao terminar — eles têm dado pessoal.

Os PDFs dos trabalhos (Storage) não entram neste backup; a organização baixa os PDFs pelo painel.
