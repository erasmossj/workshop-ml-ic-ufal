# SCA — riscos aceitos em dependências

O job **SCA (npm audit)** do CI (`.github/workflows/security.yml`) roda `node scripts/auditoria-sca.mjs`:
o mesmo `npm audit` de antes, que bloqueia o PR em aviso **alto ou crítico**, com uma diferença. Um aviso
**sem versão corrigida** pode virar risco aceito em `.github/sca-excecoes.json`, e só nestas condições:

- vale para **um** aviso (GHSA) em **um** pacote. O mesmo GHSA em outro pacote continua bloqueando;
- tem **prazo** (`ate`, fim do dia em Maceió). Vencido o prazo, o aviso volta a bloquear e o CI avisa que a
  exceção venceu;
- entra por PR `sec/`, com a justificativa registrada aqui;
- quando sair a versão corrigida, atualiza-se a dependência (o Dependabot abre o PR) e remove-se a exceção.

O CI mostra cada risco aceito como _warning_ em todo PR, para não cair no esquecimento.

## Exceções vigentes

### GHSA-fc5q-39xc-vjpf — picomatch ≤ 4.0.7 (alto) · até 31/12/2026

- **Falha**: ReDoS. Um glob com extglob de um ramo só repetido pode travar a CPU ao ser compilado.
- **Por que não há correção**: o aviso não tem versão corrigida (consultado em 18/11/2026). Ele chega
  pelas dependências de build (`astro`, `vite`, `vitest`, `eslint` e outras), e o `npm audit fix --force`
  só "resolve" rebaixando o vitest para a 3.x, o que não é correção.
- **Por que o risco é baixo aqui**: o site é estático (Astro sem adapter, servido pela Vercel). O picomatch
  só roda no build, no dev e nos testes, sempre com globs escritos no próprio repositório, e nunca com
  entrada de participante. Não vai para o navegador nem para as Edge Functions.
- **O que fazer**: quando sair o picomatch corrigido, aceitar o PR do Dependabot (ou rodar `npm update
picomatch`) e apagar esta exceção.

## Histórico

| Data       | Mudança                                                                                                                                                             |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 18/11/2026 | Astro 7.4.0 → 7.4.12 (corrige GHSA-mh32-jxcr-mh9f e GHSA-r3h5-4585-7x3w). Exceção do picomatch até 31/12. minimatch (GHSA-g3hv-75wg-m249) é moderado: não bloqueia. |
