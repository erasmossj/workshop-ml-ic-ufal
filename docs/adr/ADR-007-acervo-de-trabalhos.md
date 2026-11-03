# ADR-007 — Acervo de trabalhos aprovados (edições passadas)

- Status: Aceito (03/11/2026) · WML-73 — decisão dos stakeholders aprovada; o texto da política (versão 2026-11-03) ainda está como minuta (`privacidade.aprovada: false`).
- Contexto: a organização quer manter os artigos no banco para uma futura página de "edições passadas". A política em vigor até aqui (versão 2026-10-19), aceita por quem já se inscreveu, promete apagar **todos** os PDFs em 31/01/2027 (expurgo automático, WML-52). Guardar trabalhos por tempo indeterminado sem nova base legal violaria a finalidade e a minimização (LGPD, art. 6º, I e III) e o que foi prometido a essas pessoas.

## Decisão

1. **Só entra no acervo trabalho APROVADO** (`aprovado_oral` ou `aprovado_poster`) **e com autorização expressa e separada do autor**: caixa própria no formulário, opcional e **desmarcada** (`trabalhos.acervo`, padrão `false`; `acervo_em` registra quando autorizou ou revogou). Base legal: consentimento específico e destacado (art. 7º, I, e art. 8º, § 4º), revogável a qualquer momento (art. 8º, § 5º). O aceite geral da política **não** cobre o acervo.
2. **Quem se inscreveu antes** (versão 2026-10-19) fica fora do acervo. A organização pode pedir a autorização por e-mail (modelo no RUNBOOK); só quem responder autorizando por escrito é marcado no painel (`admin_definir_acervo`). Quem não responder continua com o PDF apagado em 31/01/2027.
3. **Tabela própria `acervo_trabalhos`, desacoplada da inscrição.** Guarda edição (`config_evento.edicao`, 2026), título, autores, resumo, status e o caminho do PDF — sem CPF, e-mail, nome do inscrito, nº de inscrição, vínculo ou chave estrangeira para `participantes`/`trabalhos`. RLS habilitado e **nenhuma policy** (deny-by-default); a página pública é feature futura e vai precisar de uma RPC/policy própria, revisada à parte.
4. **Alimentada no expurgo de PDFs.** Depois de `config_evento.expurgo_pdfs` (31/01/2027), `expurgar_dados()` copia cada trabalho elegível para o acervo e **move** o caminho do PDF (`trabalhos.pdf_path` vira `null`); `expurgo_pdfs_pendentes()` lista para apagar todos os outros (não aprovados, sem autorização ou de inscrição cancelada). O arquivo continua no bucket privado `trabalhos` com o mesmo nome UUID.
5. **Revogação.**
   - Antes de 31/01/2027: `admin_definir_acervo(nº, false)` só desmarca; o PDF sai no expurgo normal.
   - Depois: a mesma RPC apaga a linha do acervo **na hora** (título, autores e resumo) e põe o PDF na fila `pdfs_a_apagar`, que a Edge Function `expurgo` esvazia na rodada diária seguinte (`disparar_expurgo()` também acorda por essa fila).
   - Depois do expurgo final (2031), sem nº de inscrição: `admin_retirar_do_acervo(id)`.
   - A ligação inscrição → acervo fica só do lado da inscrição (`trabalhos.acervo_id`, `on delete set null`), para revogar pelo nº enquanto ele existir; some com a inscrição no expurgo final.
6. A assinatura de `register_participant()` **não muda**: o opt-in vem em `p_trabalho->>'acervo'` (Edge Function `register` só envia com trabalho e só para o valor `sim`). Controle de vagas (ADR-003) e vínculo (WML-72) seguem iguais.

### Alternativa descartada

Tirar a FK `trabalhos.participante_id → participantes` (ou trocar por `set null`) e manter o trabalho na própria tabela `trabalhos`: deixaria colunas da inscrição (prêmio, categoria, datas) e o risco de um `join` futuro reidentificar o autor, e misturaria dois prazos de retenção na mesma tabela. A tabela própria deixa explícito o que fica e facilita a revisão da futura página pública.

## Consequências

- **LGPD:** o acervo é a **única** exceção ao prazo de 31/01/2027 para PDFs e só existe com consentimento. A política (versão 2026-11-03) descreve o dado, a finalidade, a base legal, a retenção sem data (`privacidade.retencaoAcervo`: "enquanto o acervo existir, ou até a retirada") e que título, autores, resumo e PDF ficarão públicos quando a página de edições passadas existir. Autores são dado pessoal consentido; CPF e e-mail nunca entram no acervo.
- Testes: `supabase/tests/database/acervo.test.sql` (opt-in, padrão, RPCs só para organizadores, anon sem acesso, expurgo mantém só aprovado + autorizado, acervo sem dado pessoal, revogação antes e depois, sobrevivência ao expurgo final, vagas e vínculo); `src/data/retencao.test.ts` garante que o prazo dos PDFs não mudou e que a exceção do expurgo é só "aprovado + autorizado + não cancelado"; `src/data/privacidade.test.ts` cobre o texto.
- Autorizar **depois** que o PDF foi apagado não recupera o arquivo (`TRABALHO_SEM_PDF`). Status trocado depois da transferência não muda o acervo; para tirar, use a revogação.
- Sem custo novo: mesmo bucket, mesma Edge Function e mesmo `pg_cron`.
- Pendências: a organização aprovar o texto da política (`aprovada: true`) e, se quiser incluir quem já submeteu, enviar o pedido de autorização; a página de edições passadas terá ADR/revisão de segurança próprios.
