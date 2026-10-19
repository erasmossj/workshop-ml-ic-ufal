import { expect, test } from '@playwright/test';
import { privacidade } from '../src/data/evento';

// Política de privacidade (WML-38): o texto sai de src/data/evento.ts.
const emMaceio = (iso: string) =>
  new Date(`${iso}T12:00:00-03:00`).toLocaleDateString('pt-BR', { timeZone: 'America/Maceio' });

test('mostra as seções da política com prazos e serviços', async ({ page }) => {
  await page.goto('/privacidade');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Política de privacidade');
  for (const secao of [
    'Quem é o responsável',
    'Quais dados coletamos e para quê',
    'Base legal',
    'Com quem compartilhamos',
    'Por quanto tempo guardamos',
    'Como protegemos',
    'Seus direitos',
    'Contato',
  ]) {
    await expect(page.getByRole('heading', { level: 2, name: secao })).toBeVisible();
  }
  for (const r of privacidade.retencao) {
    await expect(page.getByText(emMaceio(r.ate)).first()).toBeVisible();
  }
  for (const o of privacidade.operadores) {
    await expect(page.getByText(o.nome, { exact: true })).toBeVisible();
  }
  await expect(page.getByText(`Versão de ${emMaceio(privacidade.versao)}`)).toBeVisible();
});

test('o aceite do formulário leva à política', async ({ page }) => {
  await page.goto('/inscricao');
  // exact: o rodapé tem "Política de privacidade" (minúscula); este é o link do aceite.
  await page.getByRole('link', { name: 'Política de Privacidade', exact: true }).click();
  await expect(page).toHaveURL(/\/privacidade$/);
});
