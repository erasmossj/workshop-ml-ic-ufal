// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// Build apontando para o Supabase local (npm run db:start): libera essa origem no CSP.
const supabaseLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(
  process.env.PUBLIC_SUPABASE_URL ?? '',
)
  ? ` ${process.env.PUBLIC_SUPABASE_URL}`
  : '';

// Protótipo da direção D (Gradiente moderno) — conteúdo em src/data/evento.ts.
export default defineConfig({
  // Fontes baixadas no build e servidas pelo próprio site (sem requisição a terceiros).
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: 'Sora',
      cssVariable: '--font-sora',
      weights: ['400', '600', '700', '800'],
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'Inter',
      cssVariable: '--font-inter',
      weights: ['100 900'],
      fallbacks: ['ui-sans-serif', 'system-ui', 'sans-serif'],
    },
    {
      provider: fontProviders.fontsource(),
      name: 'JetBrains Mono',
      cssVariable: '--font-jetbrains',
      weights: ['400', '500'],
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
