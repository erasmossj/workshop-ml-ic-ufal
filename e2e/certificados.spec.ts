import { expect, test } from '@playwright/test';

// Sem backend (CI/protótipo) as páginas mostram o aviso; o fluxo real (modelo, liberação, download,
// validação e e-mail) é coberto em tests/integracao/certificados.test.ts (Supabase local).
test('páginas de certificado: download e validação públicos, painel fora dos buscadores', async ({
  page,
}) => {
  await page.goto('/certificado');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Baixar certificado');
  await expect(page.locator('#form-certificado')).toHaveAttribute('method', 'post');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  await page.goto('/validar?codigo=abc');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Validar certificado');
  await expect(page.locator('#codigo-erro')).toContainText('20 letras e números');

  await page.goto('/admin/certificados');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Certificados');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  await expect(
    page.getByText('Os certificados funcionam só com o backend configurado'),
  ).toBeVisible();
});

test('formulário de download sem JavaScript não põe e-mail na URL', async ({ browser }) => {
  const contexto = await browser.newContext({ javaScriptEnabled: false });
  const pagina = await contexto.newPage();
  await pagina.goto('/certificado');
  await pagina.fill('#email', 'ana@exemplo.com');
  await pagina.fill('#numero', 'ICML26-0001');
  await pagina.click('button[type=submit]');
  await expect(pagina).not.toHaveURL(/exemplo\.com|ICML26/);
  await contexto.close();
});
