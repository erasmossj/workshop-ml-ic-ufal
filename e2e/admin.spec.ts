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

// O diálogo já vem no HTML; sem backend, abrimos à mão para checar só o layout.
for (const [largura, altura] of [
  [1366, 700],
  [360, 560],
]) {
  test(`correção de inscrição centralizada e rolável em ${largura}×${altura}`, async ({ page }) => {
    await page.setViewportSize({ width: largura, height: altura });
    await page.goto('/admin');
    await page.evaluate(() =>
      (document.getElementById('dialogo-corrigir') as HTMLDialogElement).showModal(),
    );

    const dialogo = page.getByRole('dialog', { name: 'Corrigir inscrição' });
    await expect(dialogo).toBeInViewport({ ratio: 1 });
    const caixa = (await dialogo.boundingBox())!;
    // Centralizado, com folga nas bordas (não colado no canto).
    expect(caixa.x).toBeGreaterThan(0);
    expect(caixa.y).toBeGreaterThan(0);
    expect(Math.abs(caixa.x + caixa.width / 2 - largura / 2)).toBeLessThan(2);

    // Rolagem do usuário (roda do mouse), não por script: o botão de salvar precisa aparecer.
    const salvar = dialogo.getByRole('button', { name: 'Salvar correção' });
    await page.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
    await page.mouse.wheel(0, 2000);
    // Inteiro dentro da área visível do diálogo (não cortado pela borda de baixo).
    await expect(async () => {
      const botao = (await salvar.boundingBox())!;
      expect(botao.y + botao.height).toBeLessThanOrEqual(caixa.y + caixa.height);
    }).toPass({ timeout: 2000 });
  });
}
