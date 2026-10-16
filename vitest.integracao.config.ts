import { defineConfig } from 'vitest/config';

// Integração contra o Supabase local (npm run db:start + npm run functions:serve).
export default defineConfig({
  test: {
    include: ['tests/integracao/**/*.test.ts'],
    testTimeout: 30_000,
    fileParallelism: false,
  },
});
