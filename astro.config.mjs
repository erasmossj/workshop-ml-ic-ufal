// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Build apontando para o Supabase local (npm run db:start): libera essa origem no CSP.
const supabaseLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(
  process.env.PUBLIC_SUPABASE_URL ?? '',
)
  ? ` ${process.env.PUBLIC_SUPABASE_URL}`
  : '';

// Identidade visual final (Figma "IC-ML", WML-68) — conteúdo em src/data/evento.ts.
export default defineConfig({
  // Fontes baixadas no build e servidas pelo próprio site (sem requisição a terceiros).
  // Figma: Pixelify Sans (display, no lugar da PP Neue Bit), Doto (numerais),
  // DM Sans (texto) e IBM Plex Mono (rótulos, botões e campos). Todas gratuitas (OFL).
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Pixelify Sans',
      cssVariable: '--font-pixelify',
      weights: ['500', '600'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Doto',
      cssVariable: '--font-doto',
      weights: ['700', '800'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'DM Sans',
      cssVariable: '--font-dm-sans',
      weights: ['400', '500', '600'],
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'IBM Plex Mono',
      cssVariable: '--font-plex-mono',
      weights: ['400', '500', '600'],
      fallbacks: ['ui-monospace', 'monospace'],
    },
  ],
  // CSP (WML-46): o Astro gera, por página, um <meta> com hashes dos scripts e estilos próprios —
  // sem 'unsafe-inline'. frame-ancestors só vale em cabeçalho: está no vercel.json.
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        // Supabase (API, Auth, Storage) e verificação do Turnstile.
        `connect-src 'self' https://*.supabase.co https://challenges.cloudflare.com${supabaseLocal}`,
        'frame-src https://challenges.cloudflare.com',
        "img-src 'self' data: blob:",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: {
        resources: ["'self'", 'https://challenges.cloudflare.com'],
      },
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
