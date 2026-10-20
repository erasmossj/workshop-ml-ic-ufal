import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// WCAG 2.2 AA (WML-66): o axe-core não acha tudo (teclado e leitor de tela também são checados à
// mão), mas impede regressões de contraste, rótulos, nomes acessíveis e estrutura.
const PAGINAS = ['/', '/inscricao', '/confirmacao', '/privacidade', '/admin', '/credenciamento'];

for (const caminho of PAGINAS) {
  test(`sem violação WCAG 2.2 AA detectável em ${caminho}`, async ({ page }) => {
    await page.goto(caminho);
    const r = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const resumo = r.violations.map(
      (v) => `${v.id} (${v.impact}): ${v.nodes.length}× — ${v.nodes[0]?.target.join(' ')}`,
    );
    expect(resumo).toEqual([]);
  });
}

test('formulário com erros continua acessível', async ({ page }) => {
  await page.goto('/inscricao');
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click();
  await expect(page.locator('#resumo-erros')).toBeVisible();
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
});

test('teclado: primeiro Tab mostra "Pular para o conteúdo" e ele leva ao conteúdo', async ({
  page,
}) => {
  await page.goto('/inscricao');
  await page.keyboard.press('Tab');
  const pular = page.getByRole('link', { name: 'Pular para o conteúdo' });
  await expect(pular).toBeFocused();
  await expect(pular).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#conteudo$/);
});

test('teclado: todo controle do formulário recebe foco com contorno visível', async ({ page }) => {
  await page.goto('/inscricao');
  const controles = page.locator('#conteudo form :is(input, select, textarea, button):visible');
  const total = await controles.count();
  expect(total).toBeGreaterThan(3);
  for (let i = 0; i < total; i++) {
    const c = controles.nth(i);
    await c.focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await expect(c).toBeFocused();
    const contorno = await c.evaluate((el) => {
      const s = getComputedStyle(el);
      return s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
    });
    expect(contorno, await c.evaluate((el) => el.id || el.outerHTML.slice(0, 60))).toBe(true);
  }
});
