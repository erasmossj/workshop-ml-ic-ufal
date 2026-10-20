# ADR-004 — Credenciamento por QR assinado, leitor online e operadores = organizadores

- Status: Aceito (20/10/2026)
- Contexto: no evento (02–04/12), a organização registra presença por QR para calcular as horas do certificado. O comprovante (WML-30) já traz um QR com o token `<número>.<HMAC>` (`supabase/functions/_shared/qr.ts`). Regras de negócio (WML-54): scan no modo **Dia** = presença em todas as palestras daquele dia; scan no modo **Minicurso** = presença naquela tarde do minicurso, só para quem está inscrito nele. Equipe pequena, celulares próprios, Wi-Fi do IC instável.

## Decisão

1. **QR estático assinado.** O token carrega só o número de inscrição + HMAC-SHA256 truncado (128 bits) com `QR_HMAC_SECRET`. Nenhum dado pessoal no QR. O token não expira: o mesmo QR vale nos três dias.
2. **Verificação só no servidor.** A Edge Function `check-in` exige o JWT de um organizador, verifica o HMAC em tempo constante e chama a RPC `check_in()` (service role), que grava em `presencas`. O segredo nunca vai para o navegador.
3. **Idempotência no banco.** `presencas` tem unicidade em `(participante, dia, minicurso)` com `nulls not distinct`. Repetir o scan devolve `ja_registrado` e não muda nada.
4. **Operadores = organizadores.** Mesmo login (magic link) e mesma allowlist `organizadores` do painel. Sem papel novo.
5. **Leitor online, sem fila offline.** A página `/credenciamento` (instalável como app) usa a câmera (`BarcodeDetector`, com `qr-scanner` como alternativa no Safari) e precisa de conexão. Sem rede, a tela avisa e o operador repete. Há **busca manual pelo número de inscrição** para quem esqueceu o QR (registrada com origem `manual`).
6. **Conferência visual.** A resposta mostra o nome completo para o operador conferir com a pessoa; nunca mostra CPF ou e-mail.
7. A câmera é liberada (`Permissions-Policy: camera=(self)`) **só** na rota `/credenciamento`; o resto do site continua com `camera=()`.

## Por quê

- HMAC no servidor: forjar um QR exige o segredo; trocar o número invalida a assinatura. Custo zero e sem dependência externa.
- Fila offline exigiria guardar tokens no celular e reenviar depois (replay, conflito entre aparelhos, dado em dispositivo pessoal). Para 3 dias e algumas centenas de pessoas, a busca manual cobre as quedas de rede com muito menos risco.
- Idempotência no banco elimina a corrida entre dois operadores escaneando a mesma pessoa.

## Consequências

- **Risco aceito**: um print do QR de outra pessoa registra presença para ela. Mitigação: conferência do nome na tela e, em caso de dúvida, documento com foto. Registrado no S4 (`docs/seguranca/S4-CREDENCIAMENTO.md`).
- Vazamento de `QR_HMAC_SECRET` invalida a proteção: rotacionar exige reenviar os comprovantes. Fica fora da rotação automática até depois do evento (S6).
- Se o Wi-Fi for ruim no dia, o plano B é 4G do operador; a fila offline pode ser reavaliada após o feedback dos stakeholders.
