<!--
Espelho da página "Manual do usuário — IC-ML 2026" do Confluence (espaço WML), que é exportada em
PDF para os stakeholders. Os marcadores {{LINK_ACESSO}} e {{ENDERECO}} só são preenchidos no
Confluence: o link compartilhável da Vercel nunca entra neste repositório (público).
-->

# Manual do usuário — IC-ML 2026

Guia completo do sistema de inscrição, credenciamento e certificados do **IC-ML 2026 — Workshop de
Machine Learning do IC (UFAL)**. Ele explica cada tela, para participantes e para a organização,
e reúne tudo o que é preciso para usar o sistema e validá-lo no ambiente de teste.

[[TOC]]

## 1. Sobre este manual

O sistema tem três funções:

- **Divulgar o evento**: datas, local, programação, minicurso e chamada de trabalhos.
- **Receber inscrições**: com minicurso opcional (vagas limitadas) e envio opcional de trabalho
  em PDF. O participante não cria conta nem senha.
- **Organizar o evento**: painel da organização, credenciamento por QR Code no celular e emissão
  de certificados com carga horária.

O manual é dividido assim:

| Parte                   | Para quem           | O que tem                                                       |
| ----------------------- | ------------------- | --------------------------------------------------------------- |
| 2. Primeiros passos     | Todos               | Como acessar, o que é preciso e o mapa do sistema               |
| 3. Guia do participante | Todos               | Inscrição, comprovante, credenciamento e certificado            |
| 4. Guia da organização  | Quem tem acesso     | Painel, inscrições, configuração, credenciamento e certificados |
| 5. Regras do sistema    | Todos               | O que o sistema permite e o que ele bloqueia                    |
| 6. Mensagens do sistema | Todos               | Cada aviso que pode aparecer e o que fazer                      |
| 7. Solução de problemas | Todos               | Dúvidas e problemas comuns                                      |
| 8. Glossário            | Todos               | Termos usados no sistema                                        |
| 9. Roteiro de validação | Quem está validando | Checklist e como relatar problemas                              |

> **Importante:** você está usando o **ambiente de teste**. Ele é idêntico ao site oficial, mas
> separado dele: nada do que for feito aqui aparece no site oficial nem nas inscrições reais. Pode
> errar, repetir e testar à vontade.

## 2. Primeiros passos

### 2.1 Acessar o ambiente de teste

> **Dica:** link de acesso ao ambiente de teste:
>
> [{{LINK_ACESSO}}]({{LINK_ACESSO}})

1. Abra o link acima **uma vez em cada navegador e aparelho** que for usar (computador e celular).
   Ele libera o acesso sem pedir conta.
2. A partir daí, as páginas do sistema ficam no endereço `{{ENDERECO}}`. Neste manual, as páginas
   aparecem pelo final do endereço: `/inscricao` significa `{{ENDERECO}}/inscricao`.
3. Se em algum momento aparecer uma **tela de login da Vercel**, é porque aquele navegador ainda
   não abriu o link de acesso. Abra o link completo de novo.

Não repasse o link de acesso a quem não participa da validação.

### 2.2 O que você precisa

- **Navegador atualizado**: Chrome, Edge, Firefox ou Safari, no computador ou no celular.
- **Seu e-mail**: o comprovante, o certificado e o link de acesso da organização chegam por ele.
- **Um CPF fictício**: gere um em qualquer gerador de CPF na internet (busque "gerador de CPF").
- **Um PDF de até 5 MB**, sem dados pessoais, se quiser testar o envio de trabalho.
- **Um celular com câmera**, se for testar o credenciamento (organização).

### 2.3 Cuidados com os dados

> **Atenção:** use **nome e CPF fictícios** (ex.: "Ana Teste Silva"). Nunca digite seu CPF real
> nem o de outra pessoa. O e-mail pode ser o seu, porque é para ele que as mensagens são enviadas.

- Cada inscrição ativa precisa de um e-mail diferente. Para fazer várias inscrições com o mesmo
  Gmail, use variações: `seunome+1@gmail.com`, `seunome+2@gmail.com`. Todas chegam na sua caixa.
- Em capturas de tela, mostre só dados fictícios.

### 2.4 Mapa do sistema

| Página                  | Endereço              | Quem usa                 | Para quê                                         |
| ----------------------- | --------------------- | ------------------------ | ------------------------------------------------ |
| Página inicial          | `/`                   | Todos                    | Informações do evento                            |
| Inscrição               | `/inscricao`          | Participantes            | Fazer a inscrição                                |
| Confirmação             | `/confirmacao`        | Participantes            | Ver o número, o QR Code e salvar o comprovante   |
| Política de Privacidade | `/privacidade`        | Todos                    | Como os dados pessoais são usados                |
| Certificado             | `/certificado`        | Participantes            | Baixar o certificado depois do evento            |
| Validar certificado     | `/validar`            | Qualquer pessoa          | Conferir se um certificado é autêntico           |
| Painel da organização   | `/admin`              | Organização              | Inscrições, trabalhos, configuração e presenças  |
| Certificados            | `/admin/certificados` | Organização              | Carga horária, modelo do certificado e liberação |
| Credenciamento          | `/credenciamento`     | Organização (no celular) | Registrar presenças lendo o QR Code              |

### 2.5 Como o evento funciona no sistema

1. **Inscrição**: a pessoa preenche o formulário em `/inscricao` e recebe na hora o número de
   inscrição e o QR Code.
2. **E-mail de confirmação**: em poucos minutos chega o comprovante em PDF, com o QR Code e o
   convite de agenda.
3. **Antes do evento**: a organização acompanha as inscrições, avalia os trabalhos e ajusta prazos
   e vagas no painel.
4. **No evento (02 a 04/12/2026)**: a organização lê o QR Code de cada participante no celular. A
   leitura da manhã vale para as palestras do dia; a da tarde, para o minicurso.
5. **Depois do evento**: a organização define a carga horária, prepara o modelo do certificado e
   libera os certificados. Cada pessoa com presença recebe o certificado por e-mail.
6. **Validação**: qualquer pessoa confere a autenticidade de um certificado pelo código impresso
   no rodapé.

## 3. Guia do participante

### 3.1 Página inicial

Endereço: `/`. O menu no topo leva às seções; o botão **Inscreva-se** abre o formulário.

| Seção                | O que mostra                                                                           |
| -------------------- | -------------------------------------------------------------------------------------- |
| Abertura             | Nome do evento, datas (02 a 04 de dezembro de 2026) e local                            |
| Sobre o evento       | Objetivo, público e quem realiza                                                       |
| Programação          | Atividades dos 3 dias, com horários (horário de Maceió)                                |
| Minicurso · 3 tardes | "Minicurso de Machine Learning na prática": 4 blocos, no Google Colab, vagas limitadas |
| Chamada de trabalhos | Formato do trabalho, avaliação, premiação e cronograma                                 |
| Palestras e Local    | Palestras previstas, endereço e link para o mapa                                       |
| Dúvidas              | Perguntas frequentes                                                                   |
| Rodapé               | Link para a Política de Privacidade                                                    |

Itens marcados "a confirmar" (palestrantes, por exemplo) ainda dependem da organização.

### 3.2 Fazer a inscrição

Endereço: `/inscricao`. Campos com `*` são obrigatórios. O formulário tem 4 blocos.

**Bloco 1 · Dados para o certificado**

| Campo         | Obrigatório | Regras                                                                            |
| ------------- | ----------- | --------------------------------------------------------------------------------- |
| Nome completo | Sim         | Nome e sobrenome, só letras. Sai exatamente assim no certificado.                 |
| CPF           | Sim         | CPF válido. A pontuação é colocada sozinha enquanto você digita.                  |
| E-mail        | Sim         | E-mail válido e sem outra inscrição ativa. Comprovante e certificado chegam nele. |
| Instituição   | Não         | Até 160 caracteres. Ex.: "UFAL — Instituto de Computação".                        |

**Bloco 2 · Minicurso (opcional)**

- Marque **Minicurso de Machine Learning na prática** para garantir uma vaga nas 3 tardes (02, 03
  e 04/12, no Laboratório 1).
- O número de vagas que aparece ao lado da opção é **ilustrativo** nesta versão. O limite real é
  controlado pelo sistema: quando as vagas acabam, a inscrição com minicurso é recusada.

**Bloco 3 · Trabalho (opcional)**

Marque **Quero submeter um trabalho** para abrir os campos:

| Campo                       | Obrigatório            | Regras                                                  |
| --------------------------- | ---------------------- | ------------------------------------------------------- |
| Título do trabalho          | Sim                    | Até 250 caracteres                                      |
| Autores                     | Sim                    | Nomes separados por vírgula                             |
| Resumo                      | Sim                    | Até 1.500 caracteres (o contador mostra quantos faltam) |
| Arquivo PDF                 | Sim                    | Só PDF, até 5 MB                                        |
| Quero concorrer à premiação | Não                    | Melhor trabalho de graduação e de mestrado              |
| Categoria                   | Se concorrer ao prêmio | Graduação ou Mestrado                                   |

O trabalho segue o modelo de short paper da SBC, com 4 ou 6 páginas (sem contar referências). O
envio só é aceito dentro do período de submissão.

**Bloco 4 · Confirmar**

1. Marque **Li e concordo com a Política de Privacidade**. Sem o aceite, a inscrição não é feita.
2. Faça a **verificação anti-robô** (a caixa da Cloudflare). Normalmente ela se resolve sozinha.
3. Clique em **Confirmar inscrição**. O botão mostra **Enviando…** enquanto o sistema trabalha.

Se algo estiver errado, aparece no topo o quadro **Confira os campos abaixo:**, com a lista dos
problemas. Cada item leva ao campo correspondente, que também mostra a mensagem logo abaixo dele.
As mensagens possíveis estão na Parte 6.

### 3.3 Tela de confirmação

Com a inscrição aceita, o sistema abre a tela **Inscrição confirmada**, com:

- **Número de inscrição** (formato `ICML26-0000`). Guarde: ele é pedido para baixar o certificado.
- **QR Code** do credenciamento, para mostrar na entrada do evento.
- **Resumo**: nome, CPF **mascarado** (ex.: `***.456.789-**`), palestras e apresentações (todos os
  dias), minicurso (inscrito ou não) e trabalho (enviado e aguardando avaliação, ou não submetido).
- **Salvar comprovante (PDF)**: baixa o comprovante com o QR Code.
- **Adicionar à agenda (.ics)**: baixa o convite com os 3 dias do evento, para Outlook, Apple ou
  Google Agenda. Também há links diretos para o Google Agenda, um por dia.

### 3.4 E-mail de confirmação e comprovante

Em poucos minutos chega o e-mail de confirmação ("Olá, …! Sua inscrição no IC-ML 2026 — Workshop
de Machine Learning do IC está confirmada."), com:

- quando e onde é o evento;
- o **comprovante em PDF** anexado: número de inscrição, dados da inscrição, quando e onde, e o QR
  Code para apresentar no credenciamento;
- o **convite de agenda** (.ics) anexado e links para o Google Agenda;
- o link para a programação completa.

Não chegou? Confira o spam e as abas Promoções e Atualizações. O comprovante também pode ser salvo
na tela de confirmação.

### 3.5 Política de Privacidade

Endereço: `/privacidade` (link no rodapé e no formulário). Explica, em linguagem simples:

- quais dados são pedidos (nome, CPF, e-mail, vínculo, curso, instituição, perfil LinkedIn/Lattes, minicurso, trabalho) e para quê;
- a base legal (o seu consentimento, dado ao marcar a caixa de aceite);
- quem processa os dados (hospedagem, banco de dados, e-mail e anti-robô) e que eles não são
  vendidos nem cedidos;
- até quando os dados ficam guardados: PDFs dos trabalhos até 31/01/2027; CPF, e-mail e
  instituição até 31/03/2027; nome, número de inscrição e carga horária do certificado até
  31/12/2031, para permitir a validação;
- como os dados são protegidos (CPF mascarado nas telas da organização, PDFs em área privada,
  conexão criptografada);
- os direitos do participante pela LGPD.

Nesta versão, a página aparece como **minuta**: o texto ainda está em aprovação pela organização.

### 3.6 Corrigir ou cancelar a inscrição

O participante não edita nem cancela a inscrição sozinho. Para corrigir um dado ou cancelar, ele
fala com a organização, que faz a mudança pelo painel (Parte 4).

Uma inscrição cancelada libera a vaga do minicurso. Com o mesmo e-mail, a pessoa pode se inscrever
de novo e recebe um **número novo**.

### 3.7 No dia do evento

Leve o **QR Code** do comprovante, no celular ou impresso. A organização faz a leitura:

- **de manhã**, na entrada, para registrar a presença nas palestras e apresentações do dia;
- **à tarde**, no Laboratório 1, para registrar a presença no minicurso.

Sem o QR Code, a organização encontra a inscrição pelo nome ou pelo número.

### 3.8 Baixar o certificado

Os certificados são liberados pela organização **depois do evento**, só para quem teve presença
registrada. A carga horária soma as atividades em que a pessoa esteve presente.

Quando o certificado é liberado, chega um e-mail com o **certificado em PDF anexado**, a carga
horária, o **código de validação** e o link para baixá-lo de novo.

Para baixar pelo site:

1. Acesse `/certificado` digitando o endereço (a página não aparece no menu).
2. Informe o **e-mail da inscrição** e o **número de inscrição** (começa com `ICML26-`).
3. Faça a verificação anti-robô e clique em **Baixar certificado**.
4. O PDF é baixado, e aparece o aviso "Certificado gerado. O download começou — confira a pasta de
   downloads."

O certificado traz o nome, o **CPF completo** (é o único documento em que ele aparece inteiro), a
carga horária e, no rodapé, o código de validação.

### 3.9 Validar um certificado

Qualquer pessoa (uma empresa, uma coordenação de curso) pode conferir se um certificado é
autêntico:

1. Acesse `/validar` (ou clique em **Validar certificado** na página `/certificado`).
2. Digite o **código de validação** do rodapé do certificado: 20 letras e números, com ou sem
   hífens (formato `XXXXX-XXXXX-XXXXX-XXXXX`).
3. Clique em **Validar**.

O resultado é **Certificado válido**, com o nome do participante e a carga horária, ou **Nenhum
certificado com este código**, quando o código está errado ou o certificado não foi emitido pelo
evento.

## 4. Guia da organização

> **Importante:** esta parte é só para quem está na lista de organizadores. Quem não está vê a
> mensagem "Este e-mail não tem acesso ao painel. Fale com a coordenação do evento."

### 4.1 Entrar e sair

O acesso é por **link enviado por e-mail**, sem senha. Vale para o painel, os certificados e o
credenciamento.

1. Acesse `/admin`, digite o seu e-mail e clique em **Enviar link de acesso**.
2. Aparece o aviso "Se este e-mail tiver acesso, você vai receber um link para entrar. Confira
   também o spam."
3. Abra o e-mail **no mesmo navegador** em que abriu o link de acesso do ambiente de teste e clique
   no link. Você volta ao painel já conectado.
4. Para sair, clique em **Sair**, no topo. Em computadores compartilhados, sempre saia.

Se o link do e-mail não funcionar, peça outro e use sempre o mais recente.

### 4.2 Visão geral do painel

O painel (`/admin`) tem, de cima para baixo:

1. **Resumo**: os números do evento.
2. **Presenças**: o que já foi registrado no credenciamento.
3. **Certificados**: botão **Abrir certificados**.
4. **Inscrições**: a lista, com busca, filtros, ações e exportação.
5. **Configuração do evento**: prazos, teto de e-mails e vagas do minicurso.

Depois de cada ação, um aviso aparece por alguns segundos confirmando o que foi feito.

### 4.3 Resumo

| Cartão               | O que mostra                                                          |
| -------------------- | --------------------------------------------------------------------- |
| Inscrições ativas    | Total de inscrições não canceladas                                    |
| Minicurso            | Inscritos e vagas (ex.: "12 de 30 vagas"), ou "vagas não abertas"     |
| Trabalhos submetidos | Inscrições ativas com trabalho                                        |
| E-mails              | Enviados hoje / teto diário, quantos estão na fila e quantos falharam |

### 4.4 Presenças

Cartões com o total de presentes por dia (palestras) e por tarde do minicurso, conforme o
credenciamento registra. O link **abrir o leitor de QR** leva ao credenciamento.

### 4.5 Lista de inscrições

Cada linha mostra:

| Coluna                | Conteúdo                                                                    |
| --------------------- | --------------------------------------------------------------------------- |
| Nº                    | Número de inscrição                                                         |
| Participante          | Nome, e-mail e instituição. Canceladas aparecem esmaecidas, com "Cancelada" |
| CPF                   | Sempre **mascarado** (ex.: `***.456.789-**`)                                |
| Minicurso             | Sim ou Não                                                                  |
| Trabalho              | Título, prêmio e categoria, status e **Abrir PDF**                          |
| E-mail de confirmação | Na fila, Enviando, Enviado ou Falhou, com o botão **Reenviar**              |
| Ações                 | **Corrigir** e **Cancelar**                                                 |

Para encontrar inscrições:

- **Buscar**: procura por nome, e-mail ou número. Não diferencia maiúsculas nem acentos.
- **Minicurso**: Todos, Inscritos no minicurso ou Sem minicurso.
- **Trabalho**: Todos, Com trabalho, Sem trabalho ou por status (Pendente, Aprovado (pôster),
  Aprovado (oral), Rejeitado).
- **Situação**: Ativas (padrão), Canceladas ou Todas.

Abaixo da lista aparece quantas inscrições estão no filtro atual. A lista mostra 20 por página;
use **Anterior** e **Próxima**.

### 4.6 Corrigir uma inscrição

1. Na linha da inscrição, clique em **Corrigir**.
2. Ajuste nome, e-mail ou instituição. **Por segurança, o CPF precisa ser digitado completo de
   novo**, mesmo que não mude.
3. Clique em **Salvar correção** (ou **Voltar** para desistir).
4. Se o e-mail mudou, clique em **Reenviar** para mandar a confirmação ao novo endereço.

O sistema recusa um e-mail que já esteja em outra inscrição ativa.

### 4.7 Reenviar o e-mail de confirmação

Clique em **Reenviar** na coluna "E-mail de confirmação". O e-mail volta para a fila ("E-mail de
ICML26-0000 colocado na fila.") e sai respeitando o teto diário.

### 4.8 Cancelar uma inscrição

1. Clique em **Cancelar** na linha da inscrição.
2. Confirme a pergunta "Cancelar a inscrição ICML26-0000? A vaga do minicurso será liberada."

A vaga do minicurso volta na hora. A inscrição cancelada continua visível no filtro **Canceladas**.
A pessoa pode se inscrever de novo com o mesmo e-mail e recebe um número novo.

### 4.9 Avaliar trabalhos

1. Use o filtro **Trabalho → Pendente** para ver o que falta avaliar.
2. Clique em **Abrir PDF** para ler o trabalho. Ele abre numa nova aba; o link vale por pouco
   tempo, então clique de novo se precisar reabrir.
3. Escolha o status na caixa da coluna Trabalho: **Pendente**, **Aprovado (pôster)**, **Aprovado
   (oral)** ou **Rejeitado**. A mudança é salva na hora.

Inscrições que concorrem ao prêmio mostram "Concorre ao prêmio (graduação)" ou "(mestrado)".

### 4.10 Exportar a planilha

Clique em **Exportar CSV (lista filtrada)**. O arquivo traz só as inscrições do filtro atual e abre
no Excel ou no Google Planilhas, com estas colunas: Nº de inscrição, Nome, E-mail, CPF (mascarado),
Instituição, Minicurso, Apresenta trabalho, Título do trabalho, Status do trabalho, Concorre ao
prêmio, Inscrita em, Situação, Dias presentes e Tardes no minicurso.

> **Atenção:** a planilha tem dados pessoais. Não compartilhe o arquivo fora da organização e
> apague-o quando não precisar mais.

### 4.11 Configuração do evento

**Janelas (horário de Maceió) e e-mail**

| Campo                   | O que faz                                                                  |
| ----------------------- | -------------------------------------------------------------------------- |
| Inscrições abrem/fecham | Período em que o formulário aceita inscrições                              |
| Submissões abrem/fecham | Período em que o formulário aceita trabalhos                               |
| E-mails por dia (teto)  | Limite diário de envios. O Gmail aguenta cerca de 500 por dia; deixe folga |

Clique em **Salvar janelas**. O início precisa ser antes do fim. Para prorrogar as inscrições, basta
mudar a data de fechamento.

**Vagas do minicurso**

- Informe o **total de vagas** e clique em **Salvar vagas**.
- Campo **vazio** = inscrições no minicurso ainda fechadas.
- Não é possível deixar menos vagas do que as já ocupadas.

> **Atenção:** no ambiente de teste, essas configurações valem para todos que estão testando.
> Combine antes de fechar prazos ou reduzir vagas e volte ao valor anterior depois.

### 4.12 Credenciamento (no celular)

Endereço: `/credenciamento`. Use o mesmo e-mail do painel para entrar.

1. No celular, abra o link de acesso do ambiente de teste e depois `/credenciamento`. Entre pelo
   link enviado por e-mail, aberto no próprio celular.
2. Escolha o **Dia** do evento e o **Modo**:
   - **Entrada do dia (palestras)**: de manhã, na entrada;
   - **Minicurso (tarde)**: à tarde, no laboratório.
3. Toque em **Ligar câmera** e permita o uso da câmera.
4. Aponte para o QR Code do comprovante (na tela de um celular ou impresso). O resultado aparece
   na hora.

| Resultado                          | Significado                          | O que fazer                                 |
| ---------------------------------- | ------------------------------------ | ------------------------------------------- |
| ✓ Presença registrada              | Presença gravada (com nome e número) | Liberar a entrada                           |
| ✓ Presença no minicurso registrada | Presença na tarde gravada            | Liberar a entrada                           |
| Já registrado hoje / nesta tarde   | A presença já tinha sido gravada     | Nada: não conta duas vezes                  |
| Não inscrito no minicurso          | A pessoa não tem vaga no minicurso   | Encaminhar para a mesa da organização       |
| Inscrição cancelada                | A inscrição foi cancelada            | Encaminhar para a mesa da organização       |
| Inscrição não encontrada           | O número não existe                  | Conferir o número ou encaminhar para a mesa |
| QR Code inválido                   | Não é um comprovante do evento       | Usar a busca manual                         |
| Dia fora do evento                 | O dia escolhido não é do evento      | Escolher um dos dias no topo                |

**Sem QR Code?** Em **Sem QR? Busque pelo nome ou número**, digite o nome ou o número, confira o
nome com um documento e toque em **Registrar**.

Outros detalhes:

- **Nesta sessão: N registros** mostra quantas presenças você registrou desde que abriu a tela.
- Ao sair da tela, a câmera desliga sozinha; toque em **Ligar câmera** para continuar.
- Sem internet, o aviso é "A presença NÃO foi registrada. Confira a internet (Wi-Fi ou 4G) e leia
  o QR de novo."
- Se a sessão expirar, entre de novo pelo link do e-mail.

### 4.13 Certificados

Endereço: `/admin/certificados` (botão **Abrir certificados** no painel). A tela tem 3 passos.

**Passo 1 · Carga horária**

A tabela lista cada atividade com **Dia**, **Período** (Manhã = palestras; Tarde = minicurso),
**Título** e **Carga** (horas e minutos).

1. Ajuste o título e a carga de uma linha.
2. Clique em **Salvar** na mesma linha.
3. Confira em **Evento completo** o total de quem esteve em tudo.

Cada atividade vale até 24 horas. Mudanças valem para os certificados liberados depois delas.

**Passo 2 · Modelo e posições**

1. Envie o **modelo do certificado em PDF** (até 5 MB). Se ele veio do Word, use "Salvar como PDF".
   PDFs protegidos por senha não são aceitos.
2. Em **Página exibida**, escolha a página do modelo que aparece na tela.
3. Posicione as caixas **Nome**, **CPF** e **Horas**:
   - arraste cada caixa com o mouse ou com o dedo; ou
   - selecione a caixa e use as **setas** do teclado (1 ponto por toque; com **Shift**, 10 pontos);
     ou
   - ajuste os números ao lado: **Página**, **Tamanho** da letra (6 a 72), **X**, **Y** (medido a
     partir do topo), **Largura**, **Alinhamento** (Esquerda, Centro, Direita) e **Fonte**
     (Helvetica, Helvetica negrito, Times, Times negrito).
4. Clique em **Ver prévia com dados fictícios**. Use **Baixar a prévia em PDF** para conferir no
   tamanho real.
5. Clique em **Salvar modelo e posições**.

Nomes longos diminuem a letra até caber na caixa. O rodapé com o código de validação é colocado
automaticamente.

**Passo 3 · Liberar certificados**

Os cartões mostram: **Com presença**, **Certificados emitidos**, **E-mails enviados**, **E-mails na
fila** e **E-mails com falha**.

1. Clique em **Liberar certificados** (o botão só funciona com o modelo salvo).
2. Confirme: "Liberar certificados agora? N pessoa(s) com presença ainda sem certificado vão receber
   o e-mail. Esta ação não pode ser desfeita."
3. O aviso mostra quantos certificados foram emitidos. Os e-mails saem pela fila, respeitando o
   teto diário.

> **Atenção:** a liberação não pode ser desfeita. As horas de cada pessoa ficam fixas no momento
> da liberação. Quem ganhar presença depois entra numa nova liberação.

### 4.14 Crachás

No painel, em **Crachás**, clique em **Abrir crachás** (ou no botão **Crachá** de uma linha da lista
de inscrições, que já abre com aquele participante na prévia).

- **Participantes:** busque pelo nome ou número, marque quem quiser e clique em **Gerar crachás
  selecionados** (ou em **Gerar** numa linha). Cada crachá traz o nome, o vínculo (graduação,
  mestrado ou outro), o curso e a instituição e, se a pessoa informou, o QR do LinkedIn ou do Lattes.
  Sem perfil, o espaço do QR fica vazio. O crachá não mostra CPF nem e-mail.
- **Organização:** digite nome, função e (opcional) LinkedIn ou Lattes e clique em **Adicionar
  crachá da organização**. Esses dados não são gravados: valem só para a impressão.
- **Imprimir:** clique em **Imprimir crachás**. Cada crachá sai em uma página de 100×140 mm. No
  diálogo, escolha "Salvar como PDF" ou a impressora, **sem margens** e em **escala 100%**.

> O QR do crachá da organização é lima sobre fundo escuro, como no design. A câmera do celular
> costuma ler; se algum leitor antigo falhar, use a câmera do próprio aparelho.

## 5. Regras do sistema

- **Horário**: todas as datas e horas seguem o horário de Maceió.
- **Prazos**: inscrições e trabalhos só são aceitos dentro das janelas da Configuração.
- **E-mail**: um e-mail só pode estar em uma inscrição ativa. Depois de cancelar, o mesmo e-mail
  pode ser usado de novo.
- **CPF**: pode aparecer em mais de uma inscrição, mas só ocupa **uma** vaga no minicurso.
- **Vagas do minicurso**: o sistema nunca passa do limite, nem quando muita gente se inscreve ao
  mesmo tempo. Vaga liberada por cancelamento volta na hora.
- **Trabalho**: só PDF de verdade (o sistema confere o arquivo, não só a extensão), até 5 MB.
- **CPF mascarado**: nas telas e planilhas da organização o CPF aparece sempre como
  `***.456.789-**`. Inteiro, só no certificado.
- **Anti-robô e limite de tentativas**: formulários públicos passam pela verificação da Cloudflare
  e têm limite de tentativas por rede.
- **E-mails**: saem por uma fila, com teto diário. Os que falham podem ser reenviados.
- **Certificados**: só para quem tem presença registrada; cada um tem um código de validação único.

## 6. Mensagens do sistema

**Inscrição**

| Mensagem                                                                                           | O que fazer                                          |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Informe nome e sobrenome, só com letras.                                                           | Escrever o nome completo, sem números ou símbolos    |
| CPF inválido. Confira os números.                                                                  | Conferir o CPF (use um CPF fictício válido)          |
| Informe um e-mail válido.                                                                          | Corrigir o e-mail                                    |
| Este e-mail já tem inscrição. Se errou algum dado, fale com a organização.                         | Usar outro e-mail ou pedir correção à organização    |
| Informe o título do trabalho. / Informe os autores. / Escreva o resumo.                            | Preencher o campo indicado                           |
| Anexe o PDF do trabalho.                                                                           | Escolher o arquivo                                   |
| Envie o trabalho em formato PDF.                                                                   | Enviar um arquivo PDF                                |
| O PDF deve ter no máximo 5 MB.                                                                     | Reduzir o arquivo                                    |
| Escolha a categoria para concorrer.                                                                | Escolher Graduação ou Mestrado                       |
| É preciso concordar para se inscrever.                                                             | Marcar o aceite da Política de Privacidade           |
| As vagas do minicurso acabaram. Desmarque o minicurso para concluir a inscrição.                   | Desmarcar o minicurso                                |
| As inscrições no minicurso ainda não abriram. Desmarque o minicurso para continuar.                | Desmarcar o minicurso ou aguardar                    |
| Este CPF já tem vaga no minicurso.                                                                 | Desmarcar o minicurso                                |
| As inscrições não estão abertas no momento.                                                        | Aguardar a abertura (no teste, avisar a organização) |
| O período de submissão de trabalhos está fechado. Desmarque o envio de trabalho para se inscrever. | Desmarcar o trabalho                                 |
| Não foi possível confirmar que você não é um robô. Recarregue a página e tente de novo.            | Recarregar a página                                  |
| Muitas tentativas. Aguarde alguns minutos e tente de novo.                                         | Esperar uns 10 minutos ou usar outra rede            |
| Sem conexão com o servidor. Verifique sua internet e tente de novo.                                | Conferir a internet                                  |

**Certificado e validação**

| Mensagem                                                          | O que fazer                                                    |
| ----------------------------------------------------------------- | -------------------------------------------------------------- |
| Informe o e-mail e o número de inscrição do comprovante.          | Preencher os dois campos                                       |
| Não encontramos certificado liberado para esse e-mail e número. … | Conferir os dados; o certificado só existe depois da liberação |
| O código tem 20 letras e números. Confira e tente de novo.        | Corrigir o código                                              |
| Nenhum certificado com este código                                | O código está errado ou o certificado não é do evento          |

**Painel da organização**

| Mensagem                                                                     | O que fazer                              |
| ---------------------------------------------------------------------------- | ---------------------------------------- |
| Este e-mail não tem acesso ao painel. Fale com a coordenação do evento.      | Pedir inclusão na lista de organizadores |
| Já existe outra inscrição com este e-mail.                                   | Usar outro e-mail na correção            |
| Este CPF já ocupa uma vaga no minicurso em outra inscrição.                  | Conferir as inscrições da pessoa         |
| Não é possível deixar menos vagas do que as já ocupadas.                     | Informar um número maior                 |
| Confira as datas: o início precisa ser antes do fim.                         | Corrigir as janelas                      |
| Confira a carga horária (até 24 horas) e o título da atividade.              | Corrigir a linha da carga horária        |
| Confira as posições: página, tamanho (6 a 72) e largura.                     | Corrigir os números da caixa             |
| Não foi possível abrir este PDF. Ele está protegido por senha ou corrompido? | Gerar o modelo de novo, sem senha        |
| Salve o modelo e as posições antes de liberar os certificados.               | Fazer o passo 2 dos certificados         |
| Nenhum certificado novo: todos com presença já tinham o seu.                 | Nada: não há ninguém novo para liberar   |

## 7. Solução de problemas

- **Apareceu uma tela de login da Vercel.** O navegador ainda não abriu o link de acesso do
  ambiente de teste. Abra o link completo e tente de novo.
- **O e-mail não chegou.** Espere alguns minutos e confira spam, Promoções e Atualizações. No
  painel, a coluna "E-mail de confirmação" mostra se ele está na fila, enviado ou com falha.
- **Muitas tentativas.** O limite é por rede. Se várias pessoas testam no mesmo Wi-Fi, o limite é
  dividido entre elas. Espere uns 10 minutos ou use outra rede (ex.: 4G).
- **A verificação anti-robô não passa.** Recarregue a página. Bloqueadores de anúncio podem
  atrapalhar; teste sem eles.
- **A câmera não liga ou não lê o QR.** Permita a câmera nas configurações do navegador, aumente o
  brilho da tela que mostra o QR Code e afaste um pouco o celular. Se não resolver, use a busca
  manual.
- **O link de acesso da organização não funciona.** Peça outro em **Enviar link de acesso**, use
  sempre o mais recente e abra no mesmo navegador em que abriu o link de acesso do ambiente de
  teste.
- **O certificado não baixa.** Confira o e-mail e o número de inscrição do comprovante e se os
  certificados já foram liberados.
- **Errei os dados da inscrição.** A organização corrige pelo painel.

## 8. Glossário

| Termo                     | Significado                                                         |
| ------------------------- | ------------------------------------------------------------------- |
| Ambiente de teste         | Cópia do sistema, separada do site oficial, usada para testar       |
| Número de inscrição       | Identificador da inscrição, no formato `ICML26-0000`                |
| Comprovante               | PDF com os dados da inscrição e o QR Code, enviado por e-mail       |
| QR Code                   | Código lido no credenciamento para registrar a presença             |
| Credenciamento            | Registro de presença no evento, feito pela organização              |
| CPF mascarado             | CPF com parte dos números escondida (`***.456.789-**`)              |
| Janela                    | Período em que inscrições ou submissões são aceitas                 |
| Teto de e-mails           | Máximo de e-mails enviados por dia                                  |
| Fila de e-mails           | Lista de e-mails aguardando envio                                   |
| Carga horária             | Horas que cada presença vale no certificado                         |
| Liberação de certificados | Emissão dos certificados de quem tem presença, com envio por e-mail |
| Código de validação       | Código no rodapé do certificado que prova a autenticidade           |
| Link de acesso            | Link enviado por e-mail para a organização entrar, sem senha        |

## 9. Roteiro de validação

Siga as Partes 3 e 4 e marque o que funcionou. Alguns itens dependem de outros: para baixar o
certificado (item 3.8), alguém da organização precisa registrar a sua presença (4.12), salvar o
modelo e liberar os certificados (4.13).

- [ ] 3.1 — Página inicial completa e legível no computador
- [ ] 3.1 — Página inicial legível no celular
- [ ] 3.2 — Inscrição sem minicurso e sem trabalho
- [ ] 3.2 — Inscrição com minicurso
- [ ] 3.2 — Inscrição com trabalho em PDF e premiação
- [ ] 3.2 — Mensagens de erro claras (nome, CPF, e-mail repetido, PDF inválido)
- [ ] 3.3 — Tela de confirmação com número, QR Code e CPF mascarado
- [ ] 3.3 — Comprovante salvo e convite de agenda
- [ ] 3.4 — E-mail de confirmação recebido, com os anexos
- [ ] 3.8 — Certificado baixado com nome e carga horária corretos
- [ ] 3.9 — Certificado validado pelo código do rodapé
- [ ] 4.1 — Entrada no painel pelo link do e-mail
- [ ] 4.5 — Busca, filtros e paginação
- [ ] 4.6 a 4.8 — Correção, reenvio de e-mail e cancelamento
- [ ] 4.9 — Mudança de status de um trabalho e abertura do PDF
- [ ] 4.10 — Planilha exportada com CPF mascarado
- [ ] 4.11 — Vagas do minicurso respeitadas (inscrição recusada sem vaga)
- [ ] 4.12 — Presença registrada pelo QR Code e pela busca manual
- [ ] 4.13 — Carga horária, modelo com prévia e liberação dos certificados

**Como relatar um problema ou sugestão**

Responda à mensagem em que recebeu este manual, com:

1. o **item** (ex.: 3.2) e o que você fez, passo a passo;
2. o que esperava e o que aconteceu (copie a mensagem da tela, se houver);
3. o aparelho e o navegador (ex.: celular Android, Chrome) e o horário aproximado;
4. uma captura de tela, se possível, só com dados fictícios.

Sugestões de texto, layout ou funcionalidade também são bem-vindas.
