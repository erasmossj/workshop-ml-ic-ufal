import { defineConfig } from 'vitest/config';

// Integração contra o Supabase local (npm run db:start + npm run functions:serve).
export default defineConfig({
  test: {
    include: ['tests/integracao/**/*.test.ts'],
    // Os testes de e-mail esvaziam a fila em lotes de EMAIL_LOTE (3) até a mensagem chegar.
    testTimeout: 90_000,
    fileParallelism: false,
  },
});
