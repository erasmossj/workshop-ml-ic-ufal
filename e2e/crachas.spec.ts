import { expect, test } from '@playwright/test';

// Sem backend (CI/protótipo) a página só mostra o aviso; os crachás com dados reais exigem login de
// organizador (RPC admin_listar_inscricoes). A lógica fica em src/lib/cracha.test.ts.
test('página de crachás: restrita à organização e fora dos buscadores', async ({ page }) => {
  await page.goto('/admin/crachas');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Crachás');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(page.getByText('Os crachás funcionam só com o backend configurado')).toBeVisible();
  // Os modelos ficam em <template>: nada de crachá renderizado sem login.
  await expect(page.locator('#impressao .cracha')).toHaveCount(0);
});

test('o painel leva aos crachás', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.locator('a[href="/admin/crachas"]')).toHaveCount(1);
});
