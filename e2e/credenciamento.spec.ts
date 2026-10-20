import { expect, test } from '@playwright/test';

// Sem backend (CI/protótipo) o leitor só mostra o aviso; o check-in com login real e QR assinado
// é coberto em tests/integracao/check-in.test.ts (Supabase local).
test('leitor do credenciamento fica fora do menu e dos buscadores, e é instalável', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('a[href="/credenciamento"]')).toHaveCount(0);

  await page.goto('/credenciamento');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Credenciamento');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(
    page.getByText('O credenciamento funciona só com o backend configurado'),
  ).toBeVisible();

  const manifesto = await page.request.get('/credenciamento.webmanifest');
  expect(manifesto.ok()).toBe(true);
  const m = await manifesto.json();
  expect(m.start_url).toBe('/credenciamento');
  expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(['192x192', '512x512']);
  for (const icone of m.icons) expect((await page.request.get(icone.src)).ok()).toBe(true);
});
