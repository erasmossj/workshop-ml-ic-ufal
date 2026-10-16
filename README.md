# I Workshop de Machine Learning — IC/UFAL

Site de divulgação e inscrição do **I Workshop de Machine Learning** do Instituto de Computação da UFAL, em parceria com o **IEEE Ramo Estudantil UFAL** e a **IEEE Computer Society UFAL**.

- 📅 03 a 05/12/2026 · 📍 Instituto de Computação — UFAL, Maceió
- 📝 Inscrições e submissões: 30/10 a 16/11/2026

## Desenvolvimento

```bash
npm install
npm run dev          # http://localhost:4321
npm test             # unitários (Vitest)
npm run build && npx playwright test   # E2E (usa o Edge no Windows)
```

Conteúdo do evento: `src/data/evento.ts`.

## Status

🚧 Em desenvolvimento — MVP previsto para 26/10/2026.

## Documentação

- [Plano, calendário e fases de segurança](docs/PLANO.md)
- [Decisões de arquitetura (ADRs)](docs/adr/)
- [Backlog](docs/BACKLOG.md)
- [Guia para agentes de IA](CLAUDE.md)

## Stack

Astro + Tailwind · Supabase (Postgres, Storage, Auth, Edge Functions) · Vercel · Cloudflare Turnstile — tudo em planos gratuitos.

## Licença

Código sob [MIT](LICENSE). Logos e marcas do IC/UFAL, IEEE e IEEE Computer Society pertencem a seus titulares e **não** estão cobertos pela licença.
