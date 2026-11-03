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
| E-mails (Light)             | `supabase/functions/_shared/email-confirmacao.ts` (`moldeEmail`, `painelEmail`, `tagEmail`, `botaoEmail`)          |
| Comprovante PDF (Light)     | `supabase/functions/_shared/comprovante.ts`; tokens, raios, fontes e imagens em `_shared/marca.ts`                 |

### E-mail de confirmação e comprovante (WML-74)

O Figma **não tem frame de e-mail nem de comprovante**. Os dois são compostos a partir do **Cartaz A5
(Aplicações › node `61:1662`)**, a aplicação impressa no modo Light, e da página `/confirmacao`:

| Elemento do Cartaz A5 / componente            | E-mail (`email-confirmacao.ts`)                                | Comprovante (`comprovante.ts`)                   |
| --------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| Faixa halftone (Textura/Ribbon, `61:1663`)    | `textura-faixa-claro.png` (servido em `/marca/`)               | mesmo PNG embutido, recortado a 112 pt de altura |
| Rótulo de sistema (IBM Plex Mono, caixa alta) | selo lima ✓ + "Comprovante · IC-ML 2026" em `lime-ink`         | idem, com tracking 0,08em                        |
| Título display (Pixelify Sans SemiBold)       | `FONTE_EMAIL.display` (cai para mono do sistema)               | Pixelify Sans embutida                           |
| Data (Doto + rótulo mono)                     | "02—04 · DEZ · 2026" (`datasEmDestaque()`)                     | idem, Doto ExtraBold embutida                    |
| Tags (Formatos)                               | Palestras = Lima, Minicurso = Azul, Trabalhos = Contorno       | idem                                             |
| Panel (cabeçalho com LED, faixa de pontos)    | "Dados da inscrição" (sem faixa de pontos no e-mail)           | com faixa de pontos e emissão no cabeçalho       |
| BoundingBox (etiqueta + caixa lima)           | número de inscrição                                            | número de inscrição (Doto)                       |
| QR · área lima                                | —                                                              | QR assinado (HMAC) em área `lime-500`            |
| Button Primary / Secondary                    | "Ver programação" / links do Google Agenda                     | —                                                |
| Rodapé: logo IC-ML + logo conjunto            | PNGs `logo-icml-claro` (24 px) e `logo-conjunto-preto` (34 px) | 20 pt e 28 pt (9,9 mm ≥ 8 mm)                    |

- E-mail: tabelas com CSS inline, até 600 px, sem fonte web (pilhas `FONTE_EMAIL` com fallback do sistema), PNGs servidos pelo site (`siteUrl`); sem site configurado, sai sem imagens.
- `textura-faixa-claro.png` é a Textura/Ribbon do Cartaz A5 (asset do Figma, modo Light: pontos `line-dot` e `lime-500`), renderizada sem alteração no recorte exibido pelo cartaz (559 × 129,4 → 1190 × 275 px, fundo transparente). Se a textura mudar no Figma, reexporte para `public/marca/` e `supabase/functions/_shared/marca/`.
- Pixelify Sans SemiBold e Doto ExtraBold (TTF do Fontsource, OFL — licenças em `_shared/marca/OFL-*.txt`) são embutidas só com os glifos usados; ligaduras desligadas (o "fi" da Pixelify vira outro glifo).
- Contraste conferido (AA): menor par usado é `ink-300` sobre `bg-000` (5,37:1).

### Regras de uso (resumo do Figma)

- Logo conjunto IEEE × CS × IC **obrigatório em toda aplicação**, no rodapé, altura mínima 28 px / 8 mm, separado do IC-ML por space-6 (32 px). Branco sobre fundos escuros; preto sobre claros.
- Área de proteção do IC-ML: uma coluna de pontos do símbolo (≈ ⅛ da altura do lockup). Tamanho mínimo: lockup 24 px / 12 mm; símbolo 20 px / 8 mm.
- Não: recolorir o wordmark em lima, aplicar glow ou gradiente, girar, trocar o pixel por fonte, aplicar sobre textura, fundir com o logo do IEEE.
- Button Primary uma vez por tela; rótulo com verbo, até 3 palavras. BoundingBox uma por composição.
- Tag: Palestra = Lima; Minicurso e Docente = Azul; Trabalhos = Contorno; Estudante e Outro (texto livre) = Neutra; Organização = Sólida (WML-72: vínculo Estudante/Docente/Outro substitui Graduação/Mestrado no crachá; a categoria do prêmio continua Graduação/Mestrado).

### Pendências

- No componente "Logo conjunto", o "R" de "COMPUTER" encosta na borda direita do quadro — corrigir no Figma e reexportar `public/marca/logo-conjunto-*.svg` (e os PNGs de `public/marca/` e `supabase/functions/_shared/marca/`).

## Histórico — protótipos (16/10/2026)

Arquivo: [WML — Protótipos](https://www.figma.com/design/rmT8Cf1Z1UG3ATgNBtTGqa) com as direções A–E. A direção D ("Gradiente moderno") foi usada no MVP até a identidade final (ADR-006).
