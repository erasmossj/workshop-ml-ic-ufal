# Marca e design

## Identidade final (em uso)

Arquivo Figma: **[IC-ML](https://www.figma.com/design/LmEPNS2a8dmobLs1sjCfV3/IC-ML)** — decisão em [ADR-006](../adr/ADR-006-identidade-visual-final.md).

| Página      | Conteúdo                                                                                      |
| ----------- | --------------------------------------------------------------------------------------------- |
| Capa        | Capa do design system                                                                         |
| Fundamentos | Coleção IC-ML / Color (modos Dark e Light), tipografia, espaço (4 px) e raios                 |
| Marca       | Logo IC-ML (lockup, símbolo, wordmark), logo conjunto IEEE × CS × IC e regras de uso          |
| Componentes | Button, Tag, BoundingBox, Field, Checkbox, Choice, FileDrop, ScheduleItem, Panel, QR          |
| Aplicações  | Hero do site oficial (1280×720), carrossel de programação (5 × 1080×1350), crachás 100×140 mm |
| Texturas    | Faixas e cantos de pontos (halftone)                                                          |

### Onde está no código

| Figma                       | Código                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| IC-ML / Color (Dark, Light) | `src/styles/global.css` (`:root`, `.modo-claro`, `@media print`); impressos: `supabase/functions/_shared/marca.ts` |
| Tipografia                  | `astro.config.mjs` (fontes) + utilitários `display-*`, `numeral-*`, `h1`–`h3`, `body-*`, `.rotulo`, `dado`         |
| Espaço                      | escala padrão do Tailwind (space-1…9 = `1, 2, 3, 4, 6, 8, 12, 16, 24`)                                             |
| Raios                       | `rounded-0`, `rounded-1` (2 px), `rounded-2` (6 px), `rounded-3` (16 px), `rounded-pill`                           |
| Button                      | `.btn-primario`, `.btn-secundario`, `.btn-fantasma` (+ `.btn-lg`); seta: `Seta.astro`                              |
| Field                       | `.rotulo-campo` + `.terminal` + `.campo`; ajuda `.ajuda`; erro `.erro-campo`                                       |
| Checkbox / Choice           | `.caixa-selecao` / `.escolha`                                                                                      |
| FileDrop                    | `#pdf-zona` em `FormInscricao.astro`                                                                               |
| Tag                         | `.tag` + `.tag-lima`, `.tag-azul`, `.tag-neutra`, `.tag-contorno`, `.tag-solida`                                   |
| Panel                       | `Painel.astro` (`.painel`, `.led`, `.faixa-pontos`)                                                                |
| ScheduleItem                | `ItemProgramacao.astro`                                                                                            |
| BoundingBox                 | `Deteccao.astro`                                                                                                   |
| Logos e texturas            | `public/marca/*.svg` (exportados do Figma), `Logo.astro`, `LogoConjunto.astro`                                     |
| Hero — site oficial         | `src/pages/index.astro` + `FormInscricao.astro`                                                                    |

### Regras de uso (resumo do Figma)

- Logo conjunto IEEE × CS × IC **obrigatório em toda aplicação**, no rodapé, altura mínima 28 px / 8 mm, separado do IC-ML por space-6 (32 px). Branco sobre fundos escuros; preto sobre claros.
- Área de proteção do IC-ML: uma coluna de pontos do símbolo (≈ ⅛ da altura do lockup). Tamanho mínimo: lockup 24 px / 12 mm; símbolo 20 px / 8 mm.
- Não: recolorir o wordmark em lima, aplicar glow ou gradiente, girar, trocar o pixel por fonte, aplicar sobre textura, fundir com o logo do IEEE.
- Button Primary uma vez por tela; rótulo com verbo, até 3 palavras. BoundingBox uma por composição.
- Tag: Palestra = Lima; Minicurso e Mestrado = Azul; Trabalhos = Contorno; Graduação = Neutra; Organização = Sólida.

### Pendências

- No componente "Logo conjunto", o "R" de "COMPUTER" encosta na borda direita do quadro — corrigir no Figma e reexportar `public/marca/logo-conjunto-*.svg` (e os PNGs de `public/marca/` e `supabase/functions/_shared/marca/`).

## Histórico — protótipos (16/10/2026)

Arquivo: [WML — Protótipos](https://www.figma.com/design/rmT8Cf1Z1UG3ATgNBtTGqa) com as direções A–E. A direção D ("Gradiente moderno") foi usada no MVP até a identidade final (ADR-006).
