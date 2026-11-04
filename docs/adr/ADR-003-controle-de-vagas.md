# ADR-003 — Controle de vagas dos minicursos sem overbooking

- Status: Aceito (16/10/2026) · atualizado em 03/11/2026 (alteração pela organização)
- Contexto: minicurso com vagas limitadas (1 minicurso em 3 tardes, decidido em 16/10; o desenho suporta N minicursos); algumas centenas de pessoas podem se inscrever ao mesmo tempo. Ler "vagas restantes" no front e depois gravar gera race condition.

## Decisão

Toda inscrição acontece em **uma única transação** na RPC `register_participant()` (Postgres, `SECURITY DEFINER`, chamada só pela Edge Function `register`):

1. Insere o participante (unicidade em `lower(trim(email))` entre as inscrições ativas — WML-67).
2. Para cada minicurso escolhido, ocupa a vaga com UPDATE condicional atômico:
   ```sql
   update minicursos
      set ocupadas = ocupadas + 1
    where id = $1 and vagas is not null and ocupadas < vagas
   returning id;
   ```
   Sem linha retornada → `raise exception 'MINICURSO_ESGOTADO'` (rollback de tudo).
3. Insere em `inscricoes_minicurso` (unicidade em `(cpf, minicurso_id)` e `(participante_id, minicurso_id)`).
4. Enfileira o e-mail de confirmação em `email_outbox`.

O front trata `MINICURSO_ESGOTADO` oferecendo concluir a inscrição só nas palestras (ou no outro minicurso). Cancelamento pelo admin usa `cancel_registration()`, que decrementa `ocupadas` na mesma transação.

### Alteração pela organização (03/11/2026)

Quem se inscreveu só nas palestras pode pedir vaga no minicurso depois (e vice-versa). Como o
participante não tem conta, a organização faz a mudança no painel pela RPC
`admin_alterar_minicurso(numero, minicurso, inscrever)` — a **terceira e última** porta que mexe em
`ocupadas`:

- só organizadores (`pode_administrar()`), só inscrições ativas (trava a linha do participante);
- **incluir** usa o mesmo UPDATE condicional acima: sem vaga → `MINICURSO_ESGOTADO`, `vagas is null` →
  `MINICURSO_FECHADO`, CPF já no minicurso → `CPF_JA_NO_MINICURSO` (tudo desfeito). A organização
  também não passa do limite; para abrir mais lugares, aumenta as vagas na Configuração;
- **tirar** apaga a inscrição no minicurso e decrementa `ocupadas` na mesma transação; recusado com
  presença já registrada no minicurso (`MINICURSO_COM_PRESENCA`), porque ela vale para o certificado;
- repetir a mesma ação não muda nada; cada mudança enfileira o e-mail de confirmação (o comprovante
  é montado no envio, já atualizado).

## Consequências

- Correção garantida pelo banco, não pelo front.
- `vagas is null` = minicurso ainda sem vagas definidas → inscrição fechada ("em breve").
- Teste obrigatório: pgTAP + teste de concorrência (N requisições simultâneas para a última vaga → exatamente 1 sucesso) e k6 na F4.
