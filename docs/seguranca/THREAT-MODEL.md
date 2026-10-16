# Threat model — IC-ML 2026 (S1, WML-46)

> Versão 1 — 16/10/2026. Método: STRIDE por fluxo + casos de abuso. Cada mitigação aponta a task/teste que a garante.

## Ativos

| Ativo                                               | Sensibilidade                 | Onde fica                                       |
| --------------------------------------------------- | ----------------------------- | ----------------------------------------------- |
| CPF                                                 | **Alta** (dado pessoal, LGPD) | `participantes.cpf` (Postgres)                  |
| Nome, e-mail, instituição                           | Média                         | `participantes`                                 |
| PDF e metadados do trabalho (inédito)               | Média                         | bucket privado `trabalhos` + tabela `trabalhos` |
| Vagas do minicurso                                  | Integridade                   | `minicursos.ocupadas`                           |
| Chaves (service role, Turnstile, Gmail, HMAC do QR) | **Crítica**                   | variáveis de ambiente (Supabase/Vercel/GitHub)  |
| Conta de organizador                                | Alta (vê dados de todos)      | Supabase Auth + `organizadores`                 |

## Atores e fronteiras de confiança

```
[Navegador anônimo] --HTTPS--> [Site estático (Vercel)]
        |
        +--HTTPS (anon key)--> [Edge Function register] --service role--> [Postgres + Storage]
        +--HTTPS (anon key)--> [PostgREST: só RPC vagas_publicas]
[Organizador (magic link)] --JWT--> [RPCs admin_* (verificam organizadores)]
[pg_cron + pg_net] --x-cron-secret--> [Edge Function send-emails] --SMTP 465--> [Gmail] (reserva: API Brevo)
```

Fronteira principal: **tudo que vem do navegador é não confiável**, inclusive o que a anon key permite chamar diretamente no PostgREST.

## STRIDE por fluxo

### 1. Inscrição

| Ameaça                     | Cenário                                                           | Mitigação                                                                                                                                      | Garantia                                 |
| -------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **S**poofing               | Robô cria milhares de inscrições / esgota o minicurso             | Turnstile obrigatório na Edge Function; rate-limit por IP                                                                                      | WML-26, teste S2                         |
| **T**ampering              | Chamar o PostgREST direto com a anon key e inserir/alterar linhas | RLS em todas as tabelas, **sem policy para anon**, `REVOKE ALL` de anon/authenticated; `register_participant` executável só por `service_role` | pgTAP `rls.test.sql`                     |
| **T**ampering              | Rajada concorrente na última vaga (overbooking)                   | UPDATE condicional atômico na mesma transação (ADR-003) + CHECK `ocupadas <= vagas`                                                            | pgTAP + `scripts/teste-concorrencia.mjs` |
| **T**ampering              | Burlar validação do front (CPF inválido, campos gigantes)         | Validação repetida no banco: `cpf_valido()`, CHECKs de tamanho, janela de datas                                                                | pgTAP `inscricao.test.sql`               |
| **R**epudiation            | "Não me inscrevi" / "minha vaga sumiu"                            | `criada_em`, `cancelada_em` e e-mail de confirmação na fila                                                                                    | `email_outbox`                           |
| **I**nformation disclosure | Enumerar e-mails já inscritos pela mensagem de erro               | Aceitar o risco (o usuário precisa saber que o e-mail já existe) **com** rate-limit e Turnstile; mensagem não revela outros dados              | WML-26                                   |
| **D**oS                    | Flood de requisições esgota a cota gratuita                       | Turnstile + rate-limit; Vercel/Supabase com limites gratuitos monitorados                                                                      | WML-36, WML-37                           |
| **E**levation              | Usuário comum chama RPC administrativa                            | Toda RPC `admin_*` verifica `eh_organizador()`; `SECURITY DEFINER` com `search_path` vazio                                                     | pgTAP `admin.test.sql`                   |

### 2. Upload do PDF

| Ameaça                                     | Mitigação                                                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| Arquivo malicioso renomeado para `.pdf`    | Bucket aceita só `application/pdf` e ≤ 5 MB; Edge Function confere a assinatura `%PDF-` antes de aceitar |
| Upload para caminho de outra pessoa (IDOR) | Caminho gerado no servidor (`<participante_id>/<uuid>.pdf`) em URL assinada de uso único e curta duração |
| Leitura pública dos trabalhos              | Bucket privado; organizadores leem por URL assinada gerada sob demanda                                   |

### 3. E-mail

| Ameaça                              | Mitigação                                                                                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vazamento de CPF por e-mail         | E-mail e comprovante mostram só CPF mascarado                                                                                                                        |
| Injeção de cabeçalho/HTML via nome  | Nome escapado no template HTML; cabeçalhos montados pelo nodemailer/SMTP lib, nunca por concatenação                                                                 |
| Senha do Gmail exposta              | Senha de **app** (revogável), só em segredo da Edge Function; nunca no repositório (gitleaks + push protection)                                                      |
| Qualquer um disparar o envio        | `send-emails` exige o cabeçalho `x-cron-secret` (≥ 32 caracteres, comparação em tempo constante); o valor fica no Vault do banco e nos segredos da função            |
| Rajada de e-mails / estouro do teto | Teto diário em `config_evento` aplicado na reserva (`reservar_emails`, com trava); lotes pequenos por minuto; retries com espera crescente e desistência na 5ª falha |
| Dado pessoal no erro guardado       | Mensagens do provedor passam por `erroSeguro` (função) e `erro_sem_dados_pessoais` (banco): e-mail e CPF viram `[e-mail]`/`[cpf]`                                    |
| QR do comprovante forjado           | Token `número.HMAC-SHA256` truncado (128 bits) com `QR_HMAC_SECRET`; o QR não carrega dado pessoal                                                                   |

### 4. Painel e exportação

| Ameaça                                                  | Mitigação                                                                                    |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Qualquer pessoa pedir magic link e virar "organizadora" | Login só para e-mails já cadastrados (signup desabilitado) **e** checagem em `organizadores` |
| CSV injection ao abrir no Excel                         | Escape de células que começam com `= + - @` (WML-35)                                         |
| CPF completo na planilha                                | Exportação sai de RPC que já devolve CPF mascarado                                           |

## Casos de abuso priorizados para o pentest (S3)

1. `POST /rest/v1/participantes` com a anon key → deve falhar (401/403).
2. `POST /rest/v1/rpc/register_participant` com a anon key → deve falhar.
3. 50 requisições simultâneas para 1 vaga restante → exatamente 1 sucesso.
4. Mesmo CPF com dois e-mails no mesmo minicurso → segundo recusado.
5. Nome com `<script>` → aparece escapado no painel, no PDF e no e-mail.
6. PDF com JavaScript embutido / polyglot → recusado ou servido só como download.
7. Usuário autenticado não organizador chamando `admin_listar_inscricoes` → recusado.

## Riscos aceitos

- **Enumeração de e-mail** na inscrição (mitigada por Turnstile + rate-limit).
- **Sem domínio próprio**: sem SPF/DKIM próprios; e-mail sai pelo próprio Gmail do evento.
