import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // e2e/ é do Playwright; tests/integracao/ exige o Supabase local (npm run test:integracao).
    exclude: [...configDefaults.exclude, 'e2e/**', 'tests/integracao/**'],
  },
});
