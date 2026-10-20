# Runbook de operação — IC-ML 2026

> Procedimentos da organização. Completado na entrega (WML-40). Nunca cole senha, chave secreta,
> CPF ou e-mail de participante em issue, PR, chat ou commit.

## ⚠️ Pendências de configuração

| Pendência                   | Desde      | Situação                                                                                                                                                                                                                           |
| --------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gmail oficial do evento** | 16/10/2026 | A produção envia pelo **Gmail de testes** (o mesmo do staging) porque o e-mail oficial ainda não existe. Trocar **antes de 30/10** (abertura das inscrições).                                                                      |
| **Política de privacidade** | 19/10/2026 | Controlador e prazos de retenção são proposta. A organização revisa `privacidade` em `src/data/evento.ts`, preenche `evento.contato` e marca `aprovada: true` **antes de 30/10**. Ver [Retenção](#retenção-e-expurgo-lgpd-wml-38). |

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

## Retenção e expurgo (LGPD, WML-38)

Os prazos publicados em `/privacidade` vêm de `privacidade.retencao` em `src/data/evento.ts`. Hoje
são **proposta**, a confirmar pela organização:

| Dados                                               | Apagar até | Por quê                               |
| --------------------------------------------------- | ---------- | ------------------------------------- |
| PDFs dos trabalhos (bucket `trabalhos`)             | 31/01/2027 | Avaliação e programação já concluídas |
| CPF, e-mail e instituição                           | 31/03/2027 | Prazo para baixar o certificado       |
| Nome, nº de inscrição e carga horária (certificado) | 31/12/2031 | Validação pública da autenticidade    |

- O aceite de cada participante fica em `participantes.consentimento_em`. Ele vale para a versão da
  política em vigor naquela data (`privacidade.versao`; o texto de cada versão está no histórico do Git).
- Mudou o texto da política? Atualize `privacidade.versao`. Mudou um prazo? Atualize esta tabela também.
- Pedido de exclusão de um participante (direito do titular): cancele a inscrição no `/admin` e
  registre o pedido. A eliminação definitiva entra no expurgo.
- O expurgo em si (apagar PDFs, CPFs e e-mails nas datas acima) é a fase **S6** (WML-52), depois dos
  certificados. Backups somem sozinhos em 14 dias, então não precisam de expurgo.

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

## Credenciamento no dia (WML-54/55)

Leitor de QR em `https://<site>/credenciamento`, para quem está na lista de organizadores
(mesmo login do painel). Decisões e riscos: [ADR-004](adr/ADR-004-credenciamento-qr.md) e
[S4](seguranca/S4-CREDENCIAMENTO.md).

### Antes do evento (uma vez por aparelho)

1. Abra `/credenciamento` no celular, entre com o seu e-mail e abra o link que chegar.
2. Instale como app: Android (Chrome) → menu **⋮ → Instalar app**; iPhone (Safari) →
   **Compartilhar → Adicionar à Tela de Início**.
3. Toque em **Ligar câmera** e permita o acesso. Teste com o seu próprio comprovante, no **dia
   1** (o registro de teste pode ser apagado depois — avise o responsável técnico).
4. Deixe o celular carregado e o 4G como reserva do Wi-Fi.

### Na entrada

1. Confira no topo o **dia** (vem marcado com a data de hoje) e o **modo**:
   - **Entrada do dia (palestras)** pela manhã — vale para todas as palestras daquele dia;
   - **Minicurso (tarde)** no Laboratório 1 — só para quem se inscreveu no minicurso.
2. Aponte para o QR do comprovante (impresso ou na tela do celular). Respostas:

| Tela                        | Som          | O que fazer                                                                  |
| --------------------------- | ------------ | ---------------------------------------------------------------------------- |
| ✓ Presença registrada       | 1 bipe agudo | Confira o nome com a pessoa e libere                                         |
| ! Já registrado             | 2 bipes      | Nada mudou; libere                                                           |
| ✕ Não inscrito no minicurso | bipe grave   | O minicurso tem vagas limitadas; as palestras continuam liberadas            |
| ✕ Inscrição cancelada       | bipe grave   | Encaminhe para a mesa da organização                                         |
| ✕ QR Code inválido          | bipe grave   | Não é um comprovante do evento: use a busca manual                           |
| ✕ Sem conexão               | bipe grave   | **Não registrou.** Confira a internet e leia de novo (ou use outro aparelho) |

3. **Esqueceu o QR?** Em "Sem QR? Busque pelo nome ou número", digite parte do nome ou o número
   de inscrição, confira com um documento e toque em **Registrar**.
4. Ao fim do turno, toque em **Sair** — principalmente em celular emprestado.

### Acompanhar e corrigir

- Painel `/admin` → **Presenças**: presentes por dia e por tarde do minicurso. A planilha
  exportada traz os dias de cada pessoa ("Dias presentes" e "Tardes no minicurso").
- Registrou a pessoa errada? Não há botão de desfazer: anote o número e peça ao responsável
  técnico para apagar o registro em `presencas` (SQL Editor da produção).

## Teste de carga (WML-36) — SOMENTE no staging

`load/inscricao.js`: 300 pessoas se inscrevendo ao mesmo tempo (metade no minicurso). Critérios:
p95 < 2 s, nenhum erro 5xx, nenhum overbooking. O script se recusa a rodar contra a produção.

### 1. Preparar o staging

No **SQL Editor do staging**:

```sql
-- Pausa o envio de e-mails (senão o Gmail tenta mandar para 300 endereços fictícios).
select cron.alter_job((select jobid from cron.job where jobname = 'enviar-emails'), active := false);
```

No PowerShell (o limite por origem barraria o teste, que sai todo de um IP só):

```powershell
npx supabase secrets set --project-ref aiyzqeckoyalrhlvhmmf RATE_LIMIT_MAX=100000
```

No painel `/admin` do staging, defina as vagas do minicurso (ex.: 50) para testar a disputa.

### 2. Rodar

```powershell
docker run --rm -i -e BASE_URL=https://aiyzqeckoyalrhlvhmmf.supabase.co -e ANON_KEY=<anon do staging> grafana/k6 run - < load/inscricao.js
```

Resultado esperado: thresholds com ✓, `erros_5xx` 0% e, no fim, `restantes depois` ≥ 0.

### 3. Limpar e restaurar (nesta ordem)

No **SQL Editor do staging** — cancela pelas regras do sistema (libera as vagas) e apaga as
inscrições sintéticas, junto com os e-mails delas na fila:

```sql
begin;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);
select public.cancel_registration(p.id)
  from public.participantes p
 where p.email like 'carga-%@exemplo.com' and p.cancelada_em is null;
delete from public.participantes where email like 'carga-%@exemplo.com';
commit;

-- Religa o envio de e-mails (só depois da limpeza).
select cron.alter_job((select jobid from cron.job where jobname = 'enviar-emails'), active := true);
```

No PowerShell:

```powershell
npx supabase secrets set --project-ref aiyzqeckoyalrhlvhmmf RATE_LIMIT_MAX=5
```

## DAST e pentest (S3) — SOMENTE staging

Workflow `.github/workflows/dast.yml`, sob demanda. Resultados e achados:
[`seguranca/PENTEST-MVP.md`](seguranca/PENTEST-MVP.md). **Nunca** aponte para a produção (o
workflow e o script recusam).

### Configuração (uma vez)

Os previews da Vercel pedem login; o ZAP precisa de uma chave para passar.

1. Vercel → projeto → **Settings → Deployment Protection → Protection Bypass for Automation** →
   gerar o segredo.
2. GitHub → **Settings → Secrets and variables → Actions → New repository secret**:
   `VERCEL_AUTOMATION_BYPASS_SECRET` = o segredo gerado. Nunca cole o valor em chat ou issue.

### Rodar

1. Pegue a URL de um preview (comentário da Vercel no PR, formato
   `https://workshop-ml-ic-ufal-git-<branch>-erasmo-junior.vercel.app`).
2. **Actions → dast → Run workflow**, cole a URL em `alvo`.
3. Job **Pentest da API**: falha se algum caso de abuso passar. Job **ZAP baseline**: baixe o
   artifact `zap-baseline` e faça a triagem.
4. Registre os achados em `docs/seguranca/PENTEST-MVP.md`. Achado aceito vira `IGNORE` em
   `.zap/rules.tsv`, com o motivo no relatório.

Localmente (só a API): `BASE_URL=<url do staging> ANON_KEY=<anon do staging> DIST=dist node scripts/pentest-staging.mjs`.
O script deixa inscrições sintéticas (`pentest-…@exemplo.com`) no staging e esgota o limite por
origem do seu IP por ~10 minutos.
