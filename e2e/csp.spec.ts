import { expect, test } from '@playwright/test';

// CSP (WML-46): nenhuma página pode ter recurso bloqueado pela política gerada no build.
for (const caminho of [
  '/',
  '/inscricao',
  '/confirmacao',
  '/privacidade',
  '/admin',
  '/credenciamento',
  '/admin/certificados',
  '/certificado',
  '/validar',
]) {
  test(`sem violação de CSP em ${caminho}`, async ({ page }) => {
    const violacoes: string[] = [];
    page.on('console', (m) => {
      if (/Content Security Policy/i.test(m.text())) violacoes.push(m.text());
    });
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (e) =>
        console.error(`Content Security Policy: ${e.violatedDirective} ${e.blockedURI}`),
      );
    });
    await page.goto(caminho);
    await page.waitForLoadState('load');
    // Modo real: o widget do Turnstile só renderiza se o CSP liberar o script e o iframe dele.
    if ((await page.locator('.cf-turnstile').count()) > 0) {
      // O iframe fica em shadow DOM fechado: procura pelo frame da Cloudflare.
      await expect
        .poll(
          () => page.frames().some((f) => new URL(f.url()).host === 'challenges.cloudflare.com'),
          {
            timeout: 15_000,
          },
        )
        .toBe(true);
    }
    await expect(page.locator('meta[http-equiv="content-security-policy"]')).toHaveCount(1);
    expect(violacoes).toEqual([]);
  });
}
