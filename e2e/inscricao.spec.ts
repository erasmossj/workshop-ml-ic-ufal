import { expect, test } from '@playwright/test';

// Dados sintéticos — nunca use CPF real em testes.
const CPF_TESTE = '52998224725';

test('landing mostra nome, datas e leva à inscrição', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Machine');
  await expect(page.getByText('02—04')).toBeVisible();
  await page.getByRole('link', { name: 'Inscreva-se' }).first().click();
  await expect(page).toHaveURL(/\/inscricao/);
});

test('formulário vazio mostra o resumo de erros', async ({ page }) => {
  await page.goto('/inscricao');
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click();
  const alerta = page.locator('#resumo-erros');
  await expect(alerta).toBeVisible();
  await expect(alerta).toContainText('CPF inválido');
  await expect(page.locator('#cpf')).toHaveAttribute('aria-invalid', 'true');
});

test('e-mail repetido é recusado (demonstração)', async ({ page }) => {
  await page.goto('/inscricao');
  await page.locator('#nome').fill('Participante Exemplo');
  await page.locator('#cpf').fill(CPF_TESTE);
  await page.locator('#email').fill('ja@inscrito.com');
  await page.getByLabel(/Li e concordo/).check();
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click();
  await expect(page.locator('#email-erro')).toContainText('já tem inscrição');
});

test('inscrição completa chega à confirmação com CPF mascarado', async ({ page }) => {
  await page.goto('/inscricao');
  await page.locator('#nome').fill('Participante Exemplo');
  await page.locator('#cpf').fill(CPF_TESTE);
  await expect(page.locator('#cpf')).toHaveValue('529.982.247-25');
  await page.locator('#email').fill('participante@exemplo.com');
  await page.locator('#minicurso').check();
  await page.getByLabel('Quero submeter um trabalho').check();
  await page.getByLabel('Título do trabalho *').fill('Classificação de imagens com CNNs');
  await page.getByLabel('Autores *').fill('Participante Exemplo, Coautora Exemplo');
  await page.getByLabel('Resumo *').fill('Resumo de teste.');
  await page.getByLabel('Arquivo PDF *').setInputFiles({
    name: 'trabalho.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%%EOF'),
  });
  await page.getByLabel(/Li e concordo/).check();
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click();

  await expect(page).toHaveURL(/\/confirmacao/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inscrição confirmada.');
  await expect(page.locator('#c-cpf')).toHaveText('***.982.247-**');
  await expect(page.locator('#c-numero')).toHaveText(/^ICML26-\d{4}$/);
  await expect(page.locator('#c-minicurso')).toContainText('Inscrito');
  await expect(page.locator('#c-qr svg')).toBeVisible();
  // O CPF completo nunca aparece na página.
  await expect(page.locator('body')).not.toContainText('529.982.247-25');
});

test('PDF falso (renomeado) é recusado', async ({ page }) => {
  await page.goto('/inscricao');
  await page.getByLabel('Quero submeter um trabalho').check();
  await page.getByLabel('Arquivo PDF *').setInputFiles({
    name: 'virus.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('MZ\x90\x00 não é pdf'),
  });
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click();
  await expect(page.locator('#pdf-erro')).toContainText('PDF');
});
