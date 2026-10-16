import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env.CI;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: CI ? 1 : 0,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://localhost:4321', trace: 'retain-on-failure' },
  projects: [
    // Local (Windows) usa o Edge já instalado; no CI usa o Chromium do Playwright.
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel: CI ? undefined : 'msedge' } },
    {
      name: 'celular',
      use: { ...devices['Pixel 7'], channel: CI ? undefined : 'msedge' },
    },
  ],
  webServer: {
    command: 'npm run preview -- --port 4321',
    url: 'http://localhost:4321',
    reuseExistingServer: !CI,
  },
});
