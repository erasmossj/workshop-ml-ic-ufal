# ADR-006 — Identidade visual final (design system "IC-ML" no Figma)

- Status: Aceito (30/10/2026) · WML-68
- Contexto: o site e os impressos usavam a direção D ("Gradiente moderno", protótipo de 16/10). A organização entregou a identidade final no Figma **[IC-ML](https://www.figma.com/design/LmEPNS2a8dmobLs1sjCfV3/IC-ML)**: fundamentos (cores Dark/Light, tipografia, espaço e raio), marca (logo IC-ML e logo conjunto IEEE × CS × IC), componentes e aplicações (hero do site, carrossel, crachás). Substitui a direção D.

## Decisão

1. **Tokens com os nomes do Figma** (`bg-000…300`, `ink-100…300`, `line-100/200`, `lime-500/400/ink/900`, `on-lime`, `blue-500/ink/900`, `danger`, `focus-ring`), definidos uma vez em `src/styles/global.css`. A paleta padrão do Tailwind, os raios e as fontes padrão foram desligados (`--color-*: initial`): só existem as classes da identidade.
2. **Modo Dark é o site; modo Light é impresso.** `.modo-claro` aplica o modo Light a um trecho (crachá do participante, QR do comprovante); `@media print` usa o Light no papel. Os PDFs e e-mails usam o Light por `supabase/functions/_shared/marca.ts`, que o teste `marca.test.ts` mantém igual ao CSS.
3. **Fontes:** Pixelify Sans (display; substitui a PP Neue Bit, paga), Doto (numerais), DM Sans (texto) e IBM Plex Mono (rótulos, botões, campos). Todas OFL e servidas pelo próprio site (Fontsource no build). Nos PDFs: DM Sans e IBM Plex Mono embutidas com `@pdf-lib/fontkit` (MIT), arquivos em `supabase/functions/_shared/marca/` publicados por `static_files`.
4. **Componentes do Figma viram classes/componentes Astro:** Button (`.btn-primario/-secundario/-fantasma`), Field (`.rotulo-campo` + `.terminal` + `.campo`), Checkbox (`.caixa-selecao`), Choice (`.escolha`), FileDrop (no formulário), Tag (`.tag-*`), Panel (`Painel.astro`), ScheduleItem (`ItemProgramacao.astro`), BoundingBox (`Deteccao.astro`), Logo e LogoConjunto. Os nomes de classe antigos usados pelos scripts do admin foram mantidos e redesenhados.
5. **Telas sem desenho no Figma** (seções da home abaixo do hero, páginas internas, admin, celular) são compostas com esses componentes e as regras do design system.
6. **Logos e texturas** são os SVGs exportados do Figma (`public/marca/`), sem recolorir. PNGs só onde SVG não funciona (PDF e e-mail).

## Por quê

- Nomes iguais aos do Figma deixam a conferência design × código direta e impedem cor "solta".
- Desligar a paleta padrão do Tailwind faz qualquer classe fora da identidade simplesmente não existir.
- Fontes e logos no próprio site/função: custo zero, sem requisição a terceiros (CSP `font-src 'self'`).

## Consequências

- Custo zero mantido: todas as fontes são OFL; `@pdf-lib/fontkit` é MIT.
- Contraste conferido (WCAG 2.2 AA): o par mais justo é ink-300 sobre bg-300 (4,51:1). O foco dos campos do Figma (borda lima + brilho) é desenhado como `outline`, para haver contorno de foco real.
- Se os arquivos de `_shared/marca/` não estiverem disponíveis na função, o PDF sai com Helvetica/Courier e sem logos — o envio nunca para por causa da marca.
- Atualiza o ADR-005 quanto às fontes: o comprovante e o rodapé do certificado passam a usar as fontes da marca. As fontes dos campos do certificado (Nome, CPF, Horas) continuam Helvetica/Times, escolhidas no painel; oferecer DM Sans ali exige migration (vai junto da WML-69).
- Pendência de design: no componente "Logo conjunto" do Figma, o "R" de "COMPUTER" encosta na borda direita do quadro (632 px). O SVG foi usado como está; corrigir no Figma e reexportar.
