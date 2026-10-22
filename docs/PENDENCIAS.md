# Pendências da organização e do responsável — IC-ML 2026

> Decisões e tarefas que **não dependem de código** e travam a entrega ou o go-live. Espelhado no
> Confluence (espaço `WML`, página "Pendências"). Resolveu? Marque aqui e no Confluence. Itens de
> desenvolvimento ficam no Jira (`WML`).
>
> Atualizado em 22/10/2026. Abertura das inscrições: **30/10/2026**. Entrega aos stakeholders (MVP +
> credenciamento + certificados): **23/10/2026**, no staging.

## Antes da abertura das inscrições (30/10)

| #   | Pendência                                                                                                                                                                                          | Responsável                                             | Prazo | Onde resolver                                                                           | Status |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----- | --------------------------------------------------------------------------------------- | ------ |
| 1   | Criar o **Gmail oficial** do evento e trocar o envio (hoje sai pelo Gmail de testes)                                                                                                               | Organização (criar) · Erasmo (trocar)                   | 30/10 | [RUNBOOK → Trocar o Gmail](RUNBOOK.md#trocar-o-gmail-de-envio-quando-o-oficial-existir) | Aberta |
| 2   | Definir o **e-mail público de contato** (aparece no site e na política)                                                                                                                            | Organização                                             | 30/10 | `evento.contato` em `src/data/evento.ts`                                                | Aberta |
| 3   | **Aprovar a política de privacidade**: quem é o controlador e os prazos de retenção propostos (PDFs até 31/01/2027; CPF, e-mail e instituição até 31/03/2027; dados do certificado até 31/12/2031) | Organização (+ encarregado de dados da UFAL, se houver) | 30/10 | `/privacidade` · `privacidade` em `src/data/evento.ts` (`aprovada: true`)               | Aberta |
| 4   | Definir o **número de vagas do minicurso** (limite do Laboratório 1)                                                                                                                               | Organização                                             | 30/10 | Painel `/admin` → Configuração                                                          | Aberta |
| 5   | Cadastrar os **e-mails dos organizadores** que acessam o painel                                                                                                                                    | Organização → Erasmo                                    | 30/10 | Tabela `organizadores` (pedido por canal privado, nunca em issue ou chat)               | Aberta |
| 6   | **Autorizar o go-live**: freeze, deploy em produção e abertura (WML-39)                                                                                                                            | Organização                                             | 25/10 | Reunião de go-live                                                                      | Aberta |

## Conteúdo e marca

| #   | Pendência                                                                                            | Responsável          | Prazo          | Onde resolver                                  | Status |
| --- | ---------------------------------------------------------------------------------------------------- | -------------------- | -------------- | ---------------------------------------------- | ------ |
| 7   | Escolher a **direção visual definitiva** (hoje: protótipo na direção D — Gradiente moderno) (WML-21) | Stakeholders         | o quanto antes | [`marca/`](marca/README.md) · protótipos Figma | Aberta |
| 8   | Enviar a **marca do IEEE Ramo Estudantil UFAL** (logo, cores, regras de uso) (WML-23)                | Diretoria do IEEE RE | o quanto antes | `docs/marca/` (placeholders no site até lá)    | Aberta |
| 9   | Confirmar o **palestrante da abertura** (hoje "pesquisador convidado") e os demais nomes             | Organização          | antes de 26/11 | `dias` em `src/data/evento.ts`                 | Aberta |
| 10  | Revisar os itens "a confirmar" do conteúdo (programação, FAQ, premiação)                             | Organização          | 26/10          | `src/data/evento.ts`                           | Aberta |

## Do responsável técnico (Erasmo)

| #   | Pendência                                                                                               | Prazo       | Onde resolver                                                   | Status            |
| --- | ------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------- | ----------------- |
| 11  | **Testar a restauração** de um backup com a chave `icml-backup.key`                                     | esta semana | [RUNBOOK → Restaurar um backup](RUNBOOK.md#restaurar-um-backup) | Aberta            |
| 12  | Guardar a chave do backup fora do computador (gerenciador de senhas ou pendrive da organização)         | esta semana | —                                                               | Aberta            |
| 13  | Habilitar o **Confluence** no site Atlassian, criar o espaço `WML` e reautorizar o conector (WML-13)    | agora       | admin.atlassian.com · `/mcp` no Claude Code                     | Resolvida (19/10) |
| 14  | Revisar e aprovar no Jira o que está em "Fazendo" (itens feitos por IA só vão para "Feito" com revisão) | contínuo    | Jira `WML`                                                      | Aberta            |
| 15  | Se o SMTP do login do painel usar o Gmail de testes, trocar junto com o item 1                          | 30/10       | Supabase → Authentication → SMTP Settings                       | Aberta            |
| 16  | **Testar o leitor de QR** (`/credenciamento` no staging) em um iPhone e um Android                      | 22/10       | Preview do PR de credenciamento                                 | Resolvida (22/10) |
