import { expect, test } from '@playwright/test';

// Dados sintéticos — nunca use CPF real em testes.
const CPF_TESTE = '52998224725';

test('landing mostra nome, datas e leva ao formulário de inscrição', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Machine');
  await expect(page.getByText('02—04')).toBeVisible();
  await page.getByRole('link', { name: 'Garantir inscrição' }).first().click();
  await expect(page).toHaveURL(/#inscricao$/);
  await expect(page.locator('#form-inscricao')).toBeVisible();
});

test('formulário vazio mostra o resumo de erros', async ({ page }) => {
  await page.goto('/inscricao');
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click();
  const alerta = page.locator('#resumo-erros');
  await expect(alerta).toBeVisible();
  await expect(alerta).toContainText('CPF inválido');
  await expect(page.locator('#cpf')).toHaveAttribute('aria-invalid', 'true');
});

test.describe('sem JavaScript (envio antes do script carregar)', () => {
  test.use({ javaScriptEnabled: false });

  // Achado P-03 do ZAP (S3): sem method, o envio nativo era GET e punha CPF/e-mail na URL.
  test('o formulário nunca põe dados pessoais na URL', async ({ page }) => {
    await page.goto('/inscricao');
    await page.locator('#nome').fill('Participante Exemplo');
    await page.locator('#cpf').fill(CPF_TESTE);
    await page.locator('#email').fill('sem-js@exemplo.com');
    await page.getByRole('button', { name: 'Confirmar inscrição' }).click();
    await page.waitForLoadState();
    expect(page.url()).not.toContain(CPF_TESTE);
    expect(page.url()).not.toContain('sem-js');
  });
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
  await page.locator('#vinculo').getByText('Mestrado').click();
  await page.locator('#curso').fill('Ciência da Computação');
  await page.locator('#perfil').fill('linkedin.com/in/participante-exemplo');
  await page.locator('#minicurso').check();
  await page.getByLabel(/Vou submeter trabalho/).check();
  await page.getByLabel(/^Título do trabalho/).fill('Classificação de imagens com CNNs');
  await page.getByLabel(/^Autores/).fill('Participante Exemplo, Coautora Exemplo');
  await page.getByLabel(/^Resumo/).fill('Resumo de teste.');
  await page.getByLabel(/^Arquivo PDF/).setInputFiles({
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
  // Sem backend não há token assinado: nada de QR falso que o leitor recusaria no evento.
  await expect(page.locator('#c-qr svg')).toHaveCount(0);
  await expect(page.locator('#c-qr-aviso')).toContainText('comprovante');
  // O CPF completo nunca aparece na página.
  await expect(page.locator('body')).not.toContainText('529.982.247-25');
});

test('PDF falso (renomeado) é recusado', async ({ page }) => {
  await page.goto('/inscricao');
  await page.getByLabel(/Vou submeter trabalho/).check();
  await page.getByLabel(/^Arquivo PDF/).setInputFiles({
    name: 'virus.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('MZ\x90\x00 não é pdf'),
  });
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click();
  await expect(page.locator('#pdf-erro')).toContainText('PDF');
});

test('vínculo é obrigatório e perfil só aceita LinkedIn ou Lattes', async ({ page }) => {
  await page.goto('/inscricao');
  await page.locator('#perfil').fill('https://evil.com/in/ana');
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click();
  await expect(page.locator('#vinculo-erro')).toContainText('vínculo');
  await expect(page.locator('#vinculo')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#perfil-erro')).toContainText('LinkedIn');
  await page.locator('#perfil').fill('lattes.cnpq.br/1234567890123456');
  await page.locator('#vinculo').getByText('Graduação').click();
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click();
  await expect(page.locator('#perfil-erro')).toBeEmpty();
  await expect(page.locator('#vinculo-erro')).toBeEmpty();
});
