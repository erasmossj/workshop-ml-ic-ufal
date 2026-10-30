# Manual do usuário — validação no staging (IC-ML 2026)

> Para os stakeholders testarem o sistema sozinhos, no **staging**, antes da abertura das inscrições.
> Este arquivo espelha a [página do Confluence](https://erasmojunior.atlassian.net/wiki/spaces/WML/pages/8880130),
> que é exportada em PDF e enviada junto com o link. Preparação de quem envia:
> [ENTREGA](ENTREGA.md#validação-pelos-stakeholders-manual).

## Antes de começar

- **Endereço do staging:** `<LINK DO STAGING>` — abra pelo link recebido; ele libera o acesso sem
  pedir conta. Neste manual, `/inscricao`, `/admin` etc. são páginas desse endereço (ex.:
  `<LINK DO STAGING>/admin`).
- **É um ambiente de teste.** Nada do que você fizer aqui afeta o site oficial nem as inscrições
  reais. Pode errar, repetir e testar à vontade.
- **Use nome e CPF fictícios.** Nunca digite seu CPF real. Gere um CPF de teste em um gerador de
  CPF (busque "gerador de CPF" na internet) e invente um nome, como "Ana Teste Silva".
- **Use o seu e-mail.** É para ele que vão o comprovante e o certificado. Cada inscrição ativa
  precisa de um e-mail diferente; para fazer várias, use variações como `seunome+1@gmail.com`,
  `seunome+2@gmail.com` (no Gmail, todas chegam na mesma caixa).
- **Para enviar um trabalho**, tenha à mão um PDF qualquer de até 5 MB, sem dados pessoais.
- Funciona no computador e no celular. Teste nos dois, se puder.
- Encontrou algo estranho? Veja [Como reportar um problema](#como-reportar-um-problema).

O manual tem duas partes:

- **Parte A — Participante:** para todos.
- **Parte B — Organização:** só para quem recebeu acesso de organizador (o seu e-mail precisa
  estar cadastrado; se não estiver, a tela avisa "Este e-mail não tem acesso ao painel").

## Parte A — Participante

### A1. Conhecer o site

1. Abra o link do staging.
2. Confira a página inicial: datas (02 a 04/12/2026), local, programação dos 3 dias, minicurso,
   chamada de trabalhos, cronograma e perguntas frequentes (menu no topo: Sobre, Programação,
   Minicurso, Trabalhos, FAQ).
3. No rodapé, abra a **Política de Privacidade**. Ela ainda aparece como minuta: o texto está em
   aprovação pela organização.
4. Abra o mesmo link no celular e veja se tudo fica legível.

### A2. Fazer a inscrição

1. Clique em **Inscreva-se** no topo (ou acesse `/inscricao`).
2. **1 · Dados para o certificado:** nome completo (fictício), CPF (fictício), seu e-mail e,
   se quiser, a instituição.
3. **2 · Minicurso (opcional):** marque se quiser testar a inscrição no minicurso. O número de
   vagas exibido no formulário é ilustrativo nesta versão; o limite real é controlado pelo sistema.
4. **3 · Trabalho (opcional):** marque **Quero submeter um trabalho** e preencha título, autores,
   resumo e o PDF. Se marcar **Quero concorrer à premiação**, escolha a categoria (Graduação ou
   Mestrado).
5. **4 · Confirmar:** marque o aceite da Política de Privacidade, faça a verificação anti-robô
   (a caixa da Cloudflare) e clique em **Confirmar inscrição**.

### A3. Confirmação e e-mail

Logo após confirmar, você vê a tela **Inscrição confirmada**, com:

- o **número de inscrição** (formato `ICML26-0000`) — anote, ele é usado no certificado;
- o **QR Code** para o credenciamento;
- o resumo da inscrição, com o CPF **mascarado** (ex.: `***.456.789-**`);
- os botões **Salvar comprovante (PDF)** e **Adicionar à agenda (.ics)**, além do link para o
  Google Agenda.

Em cerca de 1 minuto chega o **e-mail de confirmação**, com o comprovante em PDF (com QR Code) e o
convite de agenda. Não chegou? Confira a caixa de spam e as abas Promoções/Atualizações.

### A4. Testar os avisos do formulário

Tente provocar estes erros — o sistema deve recusar com uma mensagem clara:

| O que fazer                                 | Mensagem esperada                                                                  |
| ------------------------------------------- | ---------------------------------------------------------------------------------- |
| Digitar só o primeiro nome                  | "Informe nome e sobrenome, só com letras."                                         |
| Trocar um número do CPF                     | "CPF inválido. Confira os números."                                                |
| Usar de novo um e-mail já inscrito          | "Este e-mail já tem inscrição. Se errou algum dado, fale com a organização."       |
| Enviar um arquivo que não é PDF             | "Envie o trabalho em formato PDF."                                                 |
| Enviar um PDF maior que 5 MB                | "O PDF deve ter no máximo 5 MB."                                                   |
| Confirmar sem marcar o aceite da Política   | "É preciso concordar para se inscrever."                                           |
| Marcar o minicurso quando as vagas acabaram | "As vagas do minicurso acabaram. Desmarque o minicurso para concluir a inscrição." |

### A5. Baixar o certificado

> Este passo só funciona **depois** que a organização registrar a sua presença e liberar os
> certificados (Parte B, passos B5 e B6). Se você não tem acesso de organizador, combine com quem
> tem.

1. Acesse `/certificado` digitando o endereço (ex.: `<LINK DO STAGING>/certificado`).
2. Informe o **e-mail** e o **número de inscrição** do comprovante, faça a verificação anti-robô e
   clique em **Baixar certificado**.
3. O PDF é baixado, com o seu nome, o CPF completo (só no certificado) e a carga horária das
   atividades em que você esteve presente. O certificado também chega por e-mail.
4. Antes da liberação, a mensagem esperada é: "Não encontramos certificado liberado para esse
   e-mail e número…".

### A6. Validar um certificado

1. Na página `/certificado`, clique em **Validar certificado** (ou acesse `/validar`).
2. Digite o **código de validação** que está no rodapé do certificado (20 letras e números) e clique
   em **Validar**.
3. Resultado esperado: **Certificado válido**, com nome e carga horária. Com um código inventado:
   "Nenhum certificado com este código".

## Parte B — Organização

> Só para quem recebeu acesso de organizador. O login é por **link enviado por e-mail**, sem senha.

### B1. Entrar no painel

1. Acesse `/admin`, informe o seu e-mail e clique em **Enviar link de acesso**.
2. Abra o e-mail e clique no link. Você volta ao painel já conectado.
3. Para sair, use **Sair** no topo.

### B2. Inscrições

1. Na seção **Inscrições**, confira a lista: número, participante, CPF **mascarado**, minicurso,
   trabalho e situação do e-mail de confirmação.
2. Use **Buscar** e os filtros **Minicurso**, **Trabalho** e **Situação** (Ativas, Canceladas,
   Todas).
3. Nas **Ações** de uma linha:
   - **Corrigir**: altera nome, e-mail, CPF ou instituição (por segurança, o CPF é digitado
     completo de novo). Depois, use **Reenviar** se o e-mail mudou.
   - **Reenviar**: coloca o e-mail de confirmação na fila de novo.
   - **Cancelar**: cancela a inscrição e libera a vaga do minicurso. A pessoa pode se inscrever de
     novo com o mesmo e-mail (recebe um número novo).
4. Em inscrições com trabalho: **Abrir PDF** e mude o **status do trabalho** (Pendente, Aprovado
   para pôster, Aprovado para apresentação oral, Rejeitado).
5. **Exportar CSV (lista filtrada)**: baixa a planilha com o CPF mascarado. Não compartilhe o
   arquivo.

### B3. Configuração do evento

1. Em **Configuração do evento**, veja as janelas de inscrição e de submissão (horário de Maceió)
   e o teto de e-mails por dia. **Salvar janelas** aplica a mudança.
2. Ajuste o total de vagas do minicurso e clique em **Salvar vagas**. Teste: deixe só 1 vaga,
   faça uma inscrição com minicurso e tente outra — a segunda deve ser recusada.

> No staging, mudanças aqui afetam todos que estão testando. Combine antes de fechar janelas ou
> reduzir vagas, e volte ao valor anterior depois.

### B4. Resumo

No topo do painel: inscrições ativas, trabalhos submetidos, e-mails e presenças registradas por
dia e por tarde.

### B5. Credenciamento (no celular)

1. No celular, acesse `/credenciamento` e entre com o mesmo e-mail do painel (link por e-mail).
2. Escolha o **Dia** e o **Modo**: **Entrada do dia (palestras)** ou **Minicurso (tarde)**.
3. Toque em **Ligar câmera** (permita o uso da câmera) e aponte para o QR Code do comprovante — pode
   ser o PDF aberto na tela de outro aparelho.
4. Resultados esperados:
   - ✓ **Presença registrada**, com nome e número;
   - **Já registrado hoje** (ou **Já registrado nesta tarde**) ao ler o mesmo QR de novo;
   - **Não inscrito no minicurso** no modo Minicurso, para quem não se inscreveu nele;
   - **Inscrição cancelada** para inscrições canceladas.
5. **Sem QR?** Use **Sem QR? Busque pelo nome ou número**, confira o nome e toque em **Registrar**.
6. Volte ao painel: as presenças aparecem no **Resumo**.

### B6. Certificados

1. No painel, clique em **Abrir certificados**.
2. **1. Carga horária:** confira as atividades e a carga de cada uma; ajuste e salve se quiser
   testar.
3. **2. Modelo e posições:** envie um PDF de modelo (até 5 MB), arraste as caixas **Nome**, **CPF**
   e **Horas** para o lugar certo (ou ajuste os números), clique em **Ver prévia com dados
   fictícios** e depois em **Salvar modelo e posições**.
4. **3. Liberar certificados:** clique em **Liberar certificados**. Cada pessoa com presença recebe
   o certificado por e-mail e pode baixá-lo em `/certificado` (passo A5). Quem não tem presença
   fica de fora.

> No staging, liberar envia o certificado a todos os testadores com presença. É esperado.

## Dúvidas frequentes

- **O e-mail não chegou.** Espere alguns minutos e confira spam e abas Promoções/Atualizações. O
  comprovante também pode ser salvo na tela de confirmação.
- **"Muitas tentativas. Aguarde alguns minutos e tente de novo."** O sistema limita tentativas
  por rede para barrar robôs. Se várias pessoas testam da mesma rede (ex.: o mesmo Wi-Fi), o limite
  é dividido. Aguarde uns 10 minutos ou use outra rede (ex.: 4G).
- **"As inscrições não estão abertas no momento."** A janela de inscrição do staging está fechada.
  Avise quem enviou este manual.
- **"Não foi possível confirmar que você não é um robô."** Recarregue a página e tente de novo.
- **A câmera não lê o QR.** Confira a permissão de câmera do navegador, aumente o brilho da tela
  com o QR ou use a busca manual pelo nome ou número.
- **O link de acesso ao painel expirou.** Peça outro em **Enviar link de acesso**; use sempre o
  link mais recente.
- **Errei os dados da inscrição.** Participantes não editam a inscrição; a correção é feita pela
  organização (passo B2).

## Checklist de validação

Marque o que funcionou. Se algo falhar, anote o código do item no relato.

- [ ] A1 — Página inicial completa e legível no computador
- [ ] A1 — Página inicial legível no celular
- [ ] A2 — Inscrição sem minicurso e sem trabalho
- [ ] A2 — Inscrição com minicurso
- [ ] A2 — Inscrição com trabalho em PDF
- [ ] A3 — Tela de confirmação com número, QR Code e CPF mascarado
- [ ] A3 — Comprovante em PDF salvo pela tela
- [ ] A3 — E-mail de confirmação recebido, com PDF e convite de agenda
- [ ] A4 — Mensagens de erro claras nos testes da tabela
- [ ] A5 — Certificado baixado com nome e carga horária corretos
- [ ] A6 — Certificado validado pelo código do rodapé
- [ ] B1 — Login no painel pelo link do e-mail
- [ ] B2 — Busca, filtros, correção, cancelamento e exportação
- [ ] B2 — Mudança de status de um trabalho
- [ ] B3 — Vagas do minicurso respeitadas (inscrição recusada sem vaga)
- [ ] B5 — Presença registrada pelo QR e pela busca manual
- [ ] B6 — Modelo de certificado com prévia e liberação

## Como reportar um problema

Responda à mensagem em que você recebeu este manual com, para cada problema:

1. **Item do checklist** (ex.: A3) e **o que você fez**, passo a passo;
2. **O que esperava** e **o que aconteceu** (copie a mensagem da tela, se houver);
3. **Aparelho e navegador** (ex.: celular Android, Chrome) e **horário aproximado**;
4. **Captura de tela**, se possível — só com dados fictícios.

Sugestões de texto, layout ou funcionalidade também são bem-vindas: mande do mesmo jeito.
