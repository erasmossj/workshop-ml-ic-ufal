-- E-mail único entre inscrições ATIVAS (WML-67). Antes, a inscrição cancelada continuava ocupando
-- o e-mail e a pessoa não conseguia se inscrever de novo. Cancelou → o e-mail fica livre; a nova
-- inscrição ganha número novo e a cancelada fica no histórico (até o expurgo).
-- register_participant() e admin_corrigir_inscricao() já tratam unique_violation como
-- EMAIL_JA_INSCRITO; nada muda nelas.
drop index public.participantes_email_key;
create unique index participantes_email_ativo_key on public.participantes (email)
  where cancelada_em is null;
