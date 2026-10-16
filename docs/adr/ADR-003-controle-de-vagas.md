# ADR-003 — Controle de vagas dos minicursos sem overbooking

- Status: Aceito (16/10/2026)
- Contexto: minicurso com vagas limitadas (1 minicurso em 3 tardes, decidido em 16/10; o desenho suporta N minicursos); algumas centenas de pessoas podem se inscrever ao mesmo tempo. Ler "vagas restantes" no front e depois gravar gera race condition.

## Decisão

Toda inscrição acontece em **uma única transação** na RPC `register_participant()` (Postgres, `SECURITY DEFINER`, chamada só pela Edge Function `register`):

1. Insere o participante (unicidade em `lower(trim(email))`).
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

## Consequências

- Correção garantida pelo banco, não pelo front.
- `vagas is null` = minicurso ainda sem vagas definidas → inscrição fechada ("em breve").
- Teste obrigatório: pgTAP + teste de concorrência (N requisições simultâneas para a última vaga → exatamente 1 sucesso) e k6 na F4.
