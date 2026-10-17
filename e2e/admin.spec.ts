import { expect, test } from '@playwright/test';

// Sem backend (CI/protótipo) o painel só mostra o aviso; o fluxo com login real é coberto em
// tests/integracao/admin.test.ts (Supabase local).
test('painel da organização fica fora do menu e dos buscadores', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('a[href="/admin"]')).toHaveCount(0);

  await page.goto('/admin');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Painel da organização');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByText('O painel funciona só com o backend configurado')).toBeVisible();
});
