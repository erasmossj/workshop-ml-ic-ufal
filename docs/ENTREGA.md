# Entrega aos stakeholders — 23/10/2026 (WML-40)

> Roteiro da apresentação do MVP + credenciamento + certificados, **no staging** e só com dados
> fictícios. Duração prevista: 35–45 min. Operação do dia a dia: [RUNBOOK](RUNBOOK.md). Como o
> sistema funciona: [FUNCIONAMENTO](FUNCIONAMENTO.md). Decisões em aberto: [PENDENCIAS](PENDENCIAS.md).

## Na véspera (≈ 30 min)

1. **Staging igual à `main`**: com a CLI ligada ao staging, `npx supabase migration list` sem
   pendências e `npx supabase functions list` com as 5 funções ativas.
2. **Painel do staging → Configuração**:
   - inscrições e submissões **abertas** (a janela precisa incluir 23/10);
   - vagas do minicurso = **vagas ocupadas agora + 6**. A demonstração ocupa 5 e deixa **1 vaga**
     para a inscrição ao vivo; a tentativa seguinte mostra o minicurso esgotado.
3. **Dados fictícios**: cole [`supabase/demo/popular-demo.sql`](../supabase/demo/popular-demo.sql) no
   **SQL Editor do staging** e rode. O script recusa rodar na produção. Guarde a tabela do resultado
   (números de inscrição, e-mails `demo-NN@exemplo.com`, horas): é a cola da apresentação.
   - 12 pessoas: 5 no minicurso, 3 trabalhos (oral, pôster e um pendente), 1 cancelada e presenças
     variadas (de 0 a 22 horas). Ninguém recebe e-mail (`exemplo.com`).
4. **Modelo de certificado**: `npm run demo:modelo` gera `modelo-certificado-demo.pdf` (fora do Git).
5. **Celular do leitor**: entre em `/credenciamento` do staging com o login de organizador e ligue a
   câmera uma vez (o leitor já foi testado no celular).
6. **Abas abertas**: site, `/admin` já logado, `/admin/certificados`, o Gmail de testes do evento e
   um gerador de CPF fictício. **Nunca** use CPF real na demonstração.

## Roteiro

Abra avisando: **"todos os nomes, CPFs e e-mails que vocês vão ver são fictícios"**.

### 1. Site público (3 min)

Página inicial: data, programação dos 3 dias, minicurso, chamada de trabalhos, FAQ e política de
privacidade. No celular: o mesmo site em tela pequena.

### 2. Inscrição ao vivo (6 min)

1. Erros primeiro: CPF inválido; `demo-01@exemplo.com` → "Já existe outra inscrição com este e-mail".
2. Inscrição certa com o **Gmail de testes** e um CPF fictício, marcando o minicurso (pega a última
   vaga) e enviando um PDF de trabalho.
3. Tela de confirmação: número, QR e comprovante em PDF. Em ~1 min chega o e-mail com o PDF e o
   convite de agenda (`.ics`).
4. Outra inscrição fictícia marcando o minicurso → "As vagas do minicurso acabaram": o servidor
   não deixa passar do limite, nem com muita gente ao mesmo tempo (teste de carga com 300 pessoas).

### 3. Painel da organização (8 min)

Login pelo link no e-mail. Lista com CPF **mascarado**; filtros (minicurso, trabalhos, **Canceladas**
→ João). Trabalho do Felipe: pendente → aprovar. Exportar planilha (CPF mascarado; não compartilhe o
arquivo). Configuração: vagas e janelas (prorrogação). Fila de e-mail.

### 4. Credenciamento (6 min)

No celular, modo **Entrada do dia**, dia 02/12:

1. Ler o QR da inscrição ao vivo (na tela do notebook) → ✓ e o nome. Ler de novo → "Já registrado".
2. Modo **Minicurso** com alguém que não se inscreveu nele (busca manual, ex.: Davi) → "Não inscrito".
3. Busca manual por "Elisa" → **Registrar**.
4. Painel → **Presenças**: contagem por dia e por tarde.

### 5. Certificados (8 min)

1. **Antes, pause o e-mail** (SQL abaixo).
2. `/admin/certificados`: carga horária (6 linhas, 22 h no total); enviar
   `modelo-certificado-demo.pdf` e arrastar Nome, CPF e Horas; **prévia com dados fictícios**; salvar.
3. **Liberar certificados** → quantos foram emitidos. Lucas (sem presença) fica de fora.
4. Em `/certificado`: `demo-01@exemplo.com` + número da Alice → PDF com 22 horas.
5. Em `/validar`: código do rodapé do PDF → certificado válido.

Pausar o e-mail (SQL Editor do staging), senão a fila tenta enviar certificados para `exemplo.com`:

```sql
select cron.alter_job((select jobid from cron.job where jobname = 'enviar-emails'), active := false);
```

O certificado da inscrição ao vivo fica na fila e chega quando o envio for religado (passo 1 de
"Depois da apresentação").

### 6. Segurança e LGPD (3 min)

Sem conta para participante; anti-robô (Turnstile); banco fechado por padrão (só o servidor grava);
CPF sempre mascarado fora do comprovante e do certificado; testes de invasão S3, S4 e S5 com 0
achados Alto/Crítico; apagamento automático nas datas da política; backup diário criptografado.

### 7. Decisões de vocês (5 min)

Ver a lista abaixo.

### Se algo falhar

- **E-mail demorando**: o comprovante também baixa na tela de confirmação; volte ao Gmail no fim.
- **Câmera do celular não lê**: use a busca manual pelo número — é o mesmo registro.
- **Supabase lento ou fora**: o site público continua no ar (é estático); mostre o painel depois.

## Decisões a pedir (prazo)

Detalhes em [PENDENCIAS](PENDENCIAS.md).

1. **Gmail oficial** do evento e **e-mail público de contato** (30/10).
2. **Aprovar a política de privacidade**: controlador e prazos de retenção (30/10).
3. **Vagas do minicurso** (limite do Laboratório 1) e **e-mails dos organizadores** do painel, por
   canal privado, nunca em chat ou issue (30/10).
4. **Direção visual definitiva** e **marca do IEEE RE UFAL** (o quanto antes).
5. Conteúdo "a confirmar": palestrantes, programação, FAQ e premiação (26/10).
6. **Modelo oficial do certificado** em PDF e carga horária de cada atividade (antes do evento).
7. **Go-live** (WML-39): freeze, produção e abertura em 30/10.

## Depois da apresentação

1. Rode [`supabase/demo/limpar-demo.sql`](../supabase/demo/limpar-demo.sql) no **SQL Editor do
   staging**: cancela e apaga as 12 pessoas fictícias (as vagas voltam pela regra do sistema) e
   religa o envio de e-mails. A inscrição ao vivo continua; cancele-a no painel se quiser.
2. Registre cada pedido de ajuste como issue no Jira `WML` (26–29/10, antes da abertura).
3. Atualize [PENDENCIAS](PENDENCIAS.md) (e a página no Confluence) com as decisões tomadas.
4. Itens em "Fazendo" (certificados WML-57..60 e WML-51, este WML-40) só vão para "Feito" com a
   aprovação do responsável.

## Validação pelos stakeholders (manual)

Os stakeholders testam sozinhos, no staging, seguindo o [MANUAL](MANUAL.md) (página "Manual do
usuário — IC-ML 2026" no Confluence, enviada em PDF junto com o link).

### Antes de enviar

1. **Link**: gere o link compartilhável do preview na Vercel (Deployments → o preview → **Share**)
   e troque `<LINK DO STAGING>` na página do Confluence. Só então exporte o PDF (**⋯ → Exportar →
   PDF**). O link (com `?_vercel_share=`) dá acesso ao preview: nunca o coloque no repositório,
   que é público. Ele aponta para o preview de um branch; se o branch receber commits novos ou for
   apagado durante a validação, confira se o link continua abrindo.
   - **Login do painel no preview**: o link de acesso por e-mail volta para o endereço do preview.
     Ele precisa estar em Supabase do staging → **Authentication → URL Configuration → Redirect
     URLs** (ex.: `https://workshop-ml-ic-ufal-*-erasmo-junior.vercel.app/**`). Teste o passo B1 do
     manual uma vez antes de enviar.
2. **Staging igual à `main`** (passo 1 da véspera, acima).
3. **Painel do staging → Configuração**: inscrições e submissões **abertas**; vagas do minicurso
   **preenchidas** (campo vazio = minicurso fechado).
4. **Dados de demonstração**: se o `popular-demo.sql` ainda estiver no staging, rode o
   `limpar-demo.sql` antes (ele também religa o envio de e-mails).
5. **Parte B do manual**: inclua os e-mails de quem vai testar o painel na tabela `organizadores`
   do **staging** ([Dar ou tirar acesso](RUNBOOK.md#dar-ou-tirar-acesso-de-um-organizador)). Receba
   os e-mails por canal privado.
6. **Teste em grupo na mesma rede** (ex.: Wi-Fi do IC): o limite do staging é de 5 inscrições por
   rede a cada 10 min. Suba durante a validação e volte depois:
   ```powershell
   npx supabase secrets set --project-ref aiyzqeckoyalrhlvhmmf RATE_LIMIT_MAX=50
   ```
7. **Certificado de quem só tem a Parte A** (passo A5): alguém com acesso precisa registrar a
   presença dessas pessoas (`/credenciamento`, busca manual), ter um modelo salvo e liberar os
   certificados.

### Depois da validação

1. Volte o limite: `npx supabase secrets set --project-ref aiyzqeckoyalrhlvhmmf RATE_LIMIT_MAX=5`.
2. Tire os testadores da tabela `organizadores` do staging.
3. Cancele as inscrições de teste no painel do staging. Elas têm e-mails reais dos testadores: para
   apagar, use o SQL de limpeza do [teste de carga](RUNBOOK.md#3-limpar-e-restaurar-nesta-ordem)
   trocando o filtro `like 'carga-%@exemplo.com'` pela lista de e-mails.
4. Registre cada relato como issue no Jira `WML`.
