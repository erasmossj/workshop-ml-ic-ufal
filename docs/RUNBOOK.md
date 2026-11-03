# Runbook de operação — IC-ML 2026

> Procedimentos da organização (WML-40). Nunca cole senha, chave secreta, CPF ou e-mail de
> participante em issue, PR, chat ou commit. Como o sistema funciona por dentro:
> [`FUNCIONAMENTO.md`](FUNCIONAMENTO.md).

## Publicar uma versão (deploy)

A Vercel publica o site **sozinha** a cada merge na `main`. O Supabase (banco e Edge Functions)
**não**: é preciso publicar à mão. Se só o site for atualizado, ele passa a falar com um servidor
antigo e as inscrições podem falhar (aconteceu em 03/11/2026: formulário novo com `register` de 20/10).

Depois de **cada** merge na `main` que mexa em `supabase/migrations/` ou `supabase/functions/`,
logo em seguida (minutos), nesta ordem — primeiro o banco, depois as funções:

```bash
git switch main && git pull
npx supabase db push --project-ref sjzyipebykiaiasdafai --dry-run   # lista o que vai entrar
npx supabase db push --project-ref sjzyipebykiaiasdafai --yes
npx supabase functions deploy --project-ref sjzyipebykiaiasdafai     # publica as 5 funções
```

Conferir (só leitura):

```bash
npx supabase migration list --project-ref sjzyipebykiaiasdafai   # nenhuma sem "remote"
npx supabase functions list --project-ref sjzyipebykiaiasdafai   # data de hoje nas que mudaram
```

- Função nova que lê um segredo novo: crie o segredo **antes** do deploy (`supabase secrets set`).
- `sjzyipebykiaiasdafai` é a **produção** (`wml[prod]`); a CLI do repositório fica ligada ao
  staging. Nunca rode `db reset`, teste de carga ou dados de demonstração com esse `--project-ref`.
- Faça uma inscrição de teste no fim (e cancele no `/admin`), principalmente se o PR mudou o
  formulário ou a `register`.
- Algo falhou no meio? Não repita às cegas: guarde a saída e avise o responsável técnico. O site
  pode voltar à versão anterior pela Vercel (ver [Se algo sair do ar](#se-algo-sair-do-ar)).

## Trocar o Gmail de envio

Desde 03/11/2026 a produção envia por `ic-ml@ic.ufal.br`. Use este passo a passo para trocar a
conta ou gerar uma senha de app nova (por exemplo, se a atual vazar).

1. Na conta nova: ative a verificação em duas etapas e gere uma **senha de app**
   (myaccount.google.com/apppasswords, 16 letras).
2. Num PowerShell (fora do chat), crie o arquivo temporário `notepad $HOME\icml-gmail.env` com o
   conteúdo abaixo. No Git Bash (ou com `!` no Claude Code) a barra invertida some: use
   `notepad "$HOME/icml-gmail.env"` aqui e `rm "$HOME/icml-gmail.env"` no passo 3.
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
4. Troque também o SMTP do login do painel (Supabase → Authentication → Emails → SMTP Settings):
   host `smtp.gmail.com`, porta `465`, a mesma conta e a mesma senha de app.
5. Se a Brevo (reserva) estiver configurada, verifique o novo remetente no painel dela ou defina
   `BREVO_SENDER`; por padrão ela usa o mesmo `GMAIL_USER`.
6. Teste: uma inscrição real com e-mail da organização (`nome+teste@...`) e confira a chegada e o
   remetente; depois cancele no `/admin`.

## Operação pelo painel (`/admin`)

Tudo abaixo é feito em `https://<site>/admin`. Só entra quem está na lista de organizadores; o
painel confere a lista no banco a cada ação.

### Entrar

1. Digite o seu e-mail em **Entrar** e abra o link que chega por e-mail (confira o spam).
2. O link vale uma vez e por pouco tempo. Pediu de novo? Use só o mais recente.
3. "Muitas tentativas": espere alguns minutos — o limite protege contra abuso.

### Dar ou tirar acesso de um organizador

O pedido chega por canal privado (nunca em issue, PR ou chat público). No **SQL Editor da produção**:

```sql
insert into public.organizadores (email) values (lower('<e-mail>'));   -- dar acesso
delete from public.organizadores where email = lower('<e-mail>');      -- tirar acesso
```

A pessoa entra pelo link mágico com esse e-mail; não há senha. Quem sai da organização perde o
acesso na próxima ação do painel.

### Definir as vagas do minicurso

**Configuração do evento** → campo de vagas do minicurso → **Salvar vagas**.

- Enquanto as vagas não forem definidas, ninguém consegue se inscrever no minicurso (a inscrição no
  evento funciona normalmente).
- Dá para aumentar a qualquer momento. Reduzir só até o número de vagas já ocupadas — o sistema
  recusa um valor menor.
- A disputa pela última vaga é resolvida no banco (ADR-003); duas pessoas nunca ficam com a mesma vaga.

### Prorrogar as inscrições ou as submissões

**Configuração do evento** → **Janelas (horário de Maceió) e e-mail** → ajuste **Inscrições fecham** /
**Submissões fecham** → **Salvar janelas**. A prorrogação prevista é até **18/11 às 23:59**. O servidor
passa a aceitar o novo prazo na hora; o texto das datas na página inicial vem de
`src/data/evento.ts` e precisa de um PR para mudar.

### Exportar a planilha

**Inscrições** → aplique os filtros desejados (minicurso, trabalho, situação, busca) →
**Exportar CSV (lista filtrada)**.

- O arquivo sai com CPF mascarado, datas em horário de Maceió e proteção contra fórmulas.
- Abrir no Excel: **Dados → De Texto/CSV** → origem **65001: Unicode (UTF-8)**, para os acentos.
- A planilha tem dados pessoais: não publique, não anexe em issue, apague quando não precisar mais.

### Cancelar, corrigir ou reenviar

Na linha da inscrição, coluna **Ações**:

- **Cancelar**: pede confirmação, cancela a inscrição e **libera a vaga** do minicurso na hora. Use
  também para pedidos de exclusão de dados (veja [Retenção](#retenção-e-expurgo-lgpd-wml-38)).
- **Corrigir**: nome, e-mail, CPF ou instituição digitados errado. Mudou o e-mail? Clique em
  **Reenviar** depois, para o comprovante chegar no endereço certo.
- **Reenviar**: coloca o e-mail de confirmação (com comprovante e QR) na fila de novo.

Não existe "desfazer cancelamento": se cancelou por engano, a pessoa se inscreve de novo com o mesmo
e-mail e recebe um **número novo** (a vaga do minicurso depende de ainda haver vaga). A inscrição
cancelada fica no histórico do painel (filtro Situação → Canceladas).

### Trabalhos submetidos

- **Abrir PDF**: abre o arquivo por um link temporário (expira em minutos). Não compartilhe o link.
- Status: Pendente → Aprovado (oral) / Aprovado (pôster) / Rejeitado. O resultado sai em **26/11**;
  o status no painel é controle interno — o participante não é avisado automaticamente.
- **Autorizou acervo: sim/não**: veja [Acervo de trabalhos](#acervo-de-trabalhos-wml-73).

### Acervo de trabalhos (WML-73)

Decisão da organização ([ADR-007](adr/ADR-007-acervo-de-trabalhos.md)): para a futura página de
"edições passadas", ficam guardados **só trabalhos aprovados** (oral ou pôster) **cujo autor autorizou
por escrito**. Todo o resto continua com o PDF apagado em 31/01/2027.

- **Quem se inscreveu a partir da versão 2026-11-03 da política** marca (ou não) a caixa no
  formulário. O painel mostra **Autorizou acervo: sim/não** na coluna Trabalho e a planilha tem a
  coluna **Autorizou acervo**.
- **Quem se inscreveu antes** aceitou a versão 2026-10-19, que promete apagar o PDF em 31/01/2027:
  fica **fora** do acervo, a menos que responda autorizando. Quem não responder **não entra**.

**Registrar uma autorização (ou retirada) recebida por e-mail**

1. Guarde o e-mail da pessoa (é a prova do consentimento) na caixa do evento; não copie para o
   repositório nem para o Jira.
2. No `/admin`, busque o nº de inscrição ou o e-mail.
3. Na coluna **Trabalho**, clique em **Registrar autorização do acervo** e confirme. Para revogar,
   clique em **Retirar do acervo** e confirme.
4. Confira que a linha passou a mostrar **Autorizou acervo: sim** (ou **não**).

O que acontece depois:

- Até 31/01/2027 é só uma marcação. No primeiro expurgo depois disso (01/02/2027, 03:50), os
  trabalhos **aprovados e autorizados** vão para o acervo (sem CPF, e-mail ou nº de inscrição) e o
  PDF deles, se houver, **não** é apagado; os demais PDFs são apagados. Desde 03/11/2026 (WML-75)
  não se envia mais PDF: esses trabalhos entram só com título, autores e resumo. O botão **Abrir PDF** some nos dois casos
  (o PDF do acervo só volta a aparecer na futura página de edições passadas).
- Retirada depois disso: título, autores e resumo saem do acervo na hora; o PDF é apagado na rodada
  diária seguinte do expurgo.
- Autorização que chega **depois** de o PDF ter sido apagado é aceita, mas o arquivo não volta: o
  trabalho entra no acervo só com título, autores e resumo na rodada diária seguinte (WML-75).
- Depois de 31/12/2031 não há mais nº de inscrição: a retirada é pelo id do acervo, com
  `admin_retirar_do_acervo` (a página de edições passadas deve trazer esse botão).

**Modelo de e-mail para quem já submeteu** — só envie depois que a organização aprovar a política
(versão 2026-11-03). Vale para quem se inscreveu antes da caixa do acervo existir (todos enviaram
PDF, obrigatório até 03/11/2026). Um e-mail por pessoa (ou em cópia oculta), nunca com os endereços à vista.

> **Assunto:** IC-ML 2026 — autorização para guardar seu trabalho no acervo (opcional)
>
> Olá, [nome],
>
> Você submeteu o trabalho **"[título]"** ao IC-ML 2026 (inscrição [nº]). Quando você se inscreveu,
> nossa política de privacidade previa apagar o PDF dos trabalhos em 31/01/2027 — e é isso que vai
> acontecer, a menos que você autorize o contrário.
>
> Estamos criando um **acervo de edições passadas** do IC-ML. Se o seu trabalho for **aprovado** e
> você autorizar, vamos manter nele o **título, os autores, o resumo e o PDF**, que poderão ficar
> públicos numa página do site. O acervo **não guarda CPF nem e-mail**. A política atualizada está
> em [link para /privacidade].
>
> **A autorização é opcional.** Se não responder, nada muda: o PDF será apagado em 31/01/2027.
> Para autorizar, responda a este e-mail com a frase:
>
> _"Autorizo manter meu trabalho (título, autores, resumo e PDF) no acervo de edições passadas do
> IC-ML, se ele for aprovado."_
>
> Você pode pedir a retirada a qualquer momento por este mesmo e-mail. Se houver coautores, confirme
> que eles também concordam.
>
> Obrigado,
> Organização do IC-ML 2026 — [e-mail do evento]

### Fila de e-mail

O **Resumo** mostra quantos e-mails estão pendentes, enviados e com falha.

- **Pendente** acumulando perto do teto do dia é normal no pico: a fila continua no dia seguinte.
- **Falhou**: o sistema já tentou várias vezes com espera crescente. Confira o endereço (**Corrigir**)
  e use **Reenviar**.
- O participante também vê o comprovante na tela de confirmação, logo após se inscrever.
- **Lote**: a função envia até 3 e-mails por minuto (`EMAIL_LOTE`, padrão 3 = 180/h). Não aumente:
  cada e-mail gera um PDF e um lote maior estoura o limite de CPU da Edge Function — ela é
  encerrada no meio e os e-mails reservados só voltam à fila 10 minutos depois. Se o segredo
  `EMAIL_LOTE` estiver definido em produção (ex.: no `icml-gmail.env`), deixe-o em 3 ou remova-o.

## Cotas dos planos gratuitos

Nada aqui gera cobrança: ao atingir o limite, o serviço para ou recusa, não cobra. Confira uma vez
por semana durante as inscrições e todo dia no pico (primeiros dias e véspera do prazo).

| Serviço              | Limite (plano gratuito) | Onde ver                                  | O que fazer perto do limite                                                                                  |
| -------------------- | ----------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Gmail do evento      | ~500 destinatários/dia  | Painel → **Resumo** (fila de e-mail)      | O teto em **E-mails por dia** (padrão 450) segura a fila; o resto sai no dia seguinte. Não suba acima de 480 |
| Brevo (reserva)      | 300 e-mails/dia         | app.brevo.com → Estatísticas              | Só entra quando o Gmail falha                                                                                |
| Supabase — banco     | 500 MB                  | Supabase → projeto → **Usage**            | Esperado: poucos MB. Passou de 300 MB, algo está errado — avise o responsável técnico                        |
| Supabase — Storage   | 1 GB                    | Supabase → **Usage** (ou consulta abaixo) | PDFs de até 5 MB cada. Acima de 800 MB, peça versões menores aos autores e avise o responsável técnico       |
| Supabase — tráfego   | 5 GB/mês                | Supabase → **Usage**                      | Baixar PDFs dos trabalhos é o maior consumo; evite baixar a mesma leva várias vezes                          |
| Supabase — funções   | 500 mil execuções/mês   | Supabase → **Usage** → Edge Functions     | O esperado são alguns milhares. Pico anormal = possível abuso: avise o responsável técnico                   |
| Vercel (site)        | 100 GB de tráfego/mês   | Vercel → projeto → **Usage**              | Muito acima do esperado                                                                                      |
| Turnstile (anti-bot) | ilimitado               | dash.cloudflare.com → Turnstile           | Muitos desafios = ataque de bots; o limite por origem no servidor continua valendo                           |

Números dos planos gratuitos em 10/2026; os provedores podem mudá-los. A página **Usage** de cada um
é a fonte certa.

Consultas rápidas no **SQL Editor da produção**:

```sql
select pg_size_pretty(pg_database_size(current_database())) as banco;
select pg_size_pretty(coalesce(sum((metadata ->> 'size')::bigint), 0)) as pdfs
  from storage.objects where bucket_id = 'trabalhos';
```

## Se algo sair do ar

Primeiro confira se é geral: [status.supabase.com](https://status.supabase.com),
[vercel-status.com](https://www.vercel-status.com) e
[cloudflarestatus.com](https://www.cloudflarestatus.com) (Turnstile). Se for do provedor, aguarde e
avise nas redes do evento.

| Sintoma                                                              | Causa provável                                   | O que fazer                                                                                                                                                                                      |
| -------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Site abre, mas a inscrição dá erro para todos e o painel não carrega | **Supabase pausado** (7 dias sem uso)            | Supabase → projeto → **Restore project** (alguns minutos). Os dados não se perdem e a fila de e-mail volta sozinha. Depois veja em Actions → operacao por que o keep-alive falhou                |
| Erro só para algumas pessoas ("muitas tentativas")                   | Limite por origem (várias pessoas na mesma rede) | Normal em laboratório com o mesmo IP. Peça para tentar em alguns minutos ou pelo 4G                                                                                                              |
| Ninguém passa da verificação anti-bot                                | Turnstile fora do ar ou chave trocada            | Veja o status da Cloudflare. Se estiver normal, avise o responsável técnico                                                                                                                      |
| E-mails pararam (pendentes só crescem)                               | Teto do dia atingido ou Gmail bloqueou o envio   | Teto: espere o dia seguinte. Gmail bloqueado: a Brevo assume sozinha; se as duas falharem, avise o responsável técnico. O comprovante continua na tela de confirmação                            |
| Site inteiro fora do ar                                              | Vercel ou deploy quebrado                        | Veja o status da Vercel. Deploy quebrado: Vercel → **Deployments** → último deploy bom → **⋯ → Promote to Production** (volta a versão anterior em segundos)                                     |
| Painel diz que você não tem acesso                                   | E-mail fora da lista de organizadores            | Confira o e-mail usado; peça a inclusão ([Dar ou tirar acesso](#dar-ou-tirar-acesso-de-um-organizador))                                                                                          |
| Suspeita de vazamento (planilha publicada, chave exposta)            | —                                                | Avise o responsável técnico **na hora**. Chave exposta: gere outra no provedor e troque nos segredos. Dado pessoal exposto: a organização avalia comunicar os titulares e a ANPD (LGPD, art. 48) |

## Retenção e expurgo (LGPD, WML-38)

Os prazos publicados em `/privacidade` vêm de `privacidade.retencao` em `src/data/evento.ts`. Hoje
são **proposta**, a confirmar pela organização:

| Dados                                                   | Apagar até     | Por quê                                           |
| ------------------------------------------------------- | -------------- | ------------------------------------------------- |
| PDFs dos trabalhos sem autorização ou não aprovados     | 31/01/2027     | Avaliação e programação já concluídas             |
| CPF, e-mail, instituição, curso, perfil e "outro"       | 31/03/2027     | Prazo para baixar o certificado                   |
| Nome, nº de inscrição e carga horária (certificado)     | 31/12/2031     | Validação pública da autenticidade                |
| Acervo: trabalho aprovado e autorizado (sem CPF/e-mail) | até a retirada | Edições passadas (consentimento à parte, ADR-007) |

- O aceite de cada participante fica em `participantes.consentimento_em`. Ele vale para a versão da
  política em vigor naquela data (`privacidade.versao`; o texto de cada versão está no histórico do Git).
- Mudou o texto da política? Atualize `privacidade.versao`. Mudou um prazo? Atualize esta tabela também.
- Pedido de exclusão de um participante (direito do titular): cancele a inscrição no `/admin` e
  registre o pedido. A eliminação definitiva entra no expurgo.
- O expurgo é **automático** (S6, WML-52): todo dia às 03:50, só quando um prazo venceu. PDFs saem
  pela API do Storage; CPF, e-mail, instituição, curso e perfil em 01/04/2027; o resto em 01/01/2032. Detalhes e o
  checklist de revogação de acessos e rotação de segredos:
  [`seguranca/S6-LGPD-POS-EVENTO.md`](seguranca/S6-LGPD-POS-EVENTO.md). Mudou um prazo? Mude a política
  (`src/data/evento.ts`) **e** `config_evento` — um teste confere que são iguais. Backups somem
  sozinhos em 14 dias, então não precisam de expurgo.

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

## Certificados (WML-57..60)

Tudo em `https://<site>/admin/certificados` (botão **Abrir certificados** no painel). Decisões:
[ADR-002](adr/ADR-002-certificado-pdf.md), [ADR-005](adr/ADR-005-certificados-sob-demanda.md);
segurança: [S5](seguranca/S5-CERTIFICADOS.md).

### Antes do evento

1. **Carga horária**: confira as 6 linhas (3 manhãs + 3 tardes do minicurso). A programação
   sugere 22 horas no total; ajuste horas e minutos e clique em **Salvar** em cada linha.
2. **Modelo**: exporte o certificado aprovado em PDF (Word/Google Docs → "Salvar como PDF"), com
   espaço em branco onde entram o nome, o CPF e a carga horária.
3. Em **Modelo e posições**, envie o PDF e arraste as caixas **Nome**, **CPF** e **Horas** para os
   espaços (ou ajuste pelos números ao lado). Escolha fonte, tamanho e alinhamento.
4. **Ver prévia com dados fictícios** → confira; baixe a prévia e abra no leitor de PDF.
5. **Salvar modelo e posições**.

O rodapé com o código de validação e o endereço `/validar` é colocado automaticamente na 1ª página.

### Liberar (depois do evento)

1. Confira as **Presenças** no painel (o certificado só vai para quem tem presença).
2. **Liberar certificados** → confirme. Cada pessoa com presença recebe o e-mail com o PDF (a fila
   respeita o teto diário de e-mail; com muitas pessoas, o envio leva mais de um dia).
3. As horas ficam **fixas** na liberação. Quem ganhar presença depois (correção) entra numa nova
   liberação — clique de novo; quem já tinha certificado não recebe outro.

### Dúvidas comuns dos participantes

- **Não recebi**: confira o spam; ou baixe em `https://<site>/certificado` com o e-mail e o número
  de inscrição do comprovante.
- **Nome errado**: corrija no painel (**Corrigir**) — o próximo download sai com o nome novo.
- **Horas erradas**: o certificado já emitido guarda as horas da liberação. Para corrigir, o
  responsável técnico apaga a emissão daquela pessoa (`certificados`) e a organização libera de novo.
- **Conferir se um certificado é verdadeiro**: `https://<site>/validar` com o código do rodapé.

## Dados de demonstração (WML-40) — SOMENTE no staging

Para apresentar o sistema com dados fictícios: [`supabase/demo/popular-demo.sql`](../supabase/demo/popular-demo.sql)
(12 pessoas `demo-NN@exemplo.com`, com minicurso, trabalhos, uma cancelada e presenças) e, no fim,
[`supabase/demo/limpar-demo.sql`](../supabase/demo/limpar-demo.sql). Os dois rodam no SQL Editor do
staging e recusam a produção. Modelo de certificado de exemplo: `npm run demo:modelo`. Roteiro
completo: [ENTREGA](ENTREGA.md).

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
