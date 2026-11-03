import AxeBuilder from '@axe-core/playwright';
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
  await page.locator('#vinculo').getByText('Docente').click();
  await page.locator('#curso').fill('Ciência da Computação');
  await page.locator('#perfil').fill('linkedin.com/in/participante-exemplo');
  await page.locator('#minicurso').check();
  await page.getByLabel(/Vou submeter trabalho/).check();
  await page.getByLabel(/^Título do trabalho/).fill('Classificação de imagens com CNNs');
  await page.getByLabel(/^Autores/).fill('Participante Exemplo, Coautora Exemplo');
  await page.getByLabel(/^Resumo/).fill('Resumo de teste.');
  await page.getByLabel(/Li e concordo/).check();
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click();

  await expect(page).toHaveURL(/\/confirmacao/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inscrição confirmada.');
  await expect(page.locator('#c-cpf')).toHaveText('***.982.247-**');
  await expect(page.locator('#c-numero')).toHaveText(/^ICML26-\d{4}$/);
  await expect(page.locator('#c-minicurso')).toContainText('Inscrito');
  await expect(page.locator('#c-trabalho')).toHaveText('Enviado · aguardando avaliação');
  // Sem backend não há token assinado: nada de QR falso que o leitor recusaria no evento.
  await expect(page.locator('#c-qr svg')).toHaveCount(0);
  await expect(page.locator('#c-qr-aviso')).toContainText('comprovante');
  // O CPF completo nunca aparece na página.
  await expect(page.locator('body')).not.toContainText('529.982.247-25');
});

test('trabalho pede só título, autores e resumo — sem PDF nem premiação', async ({ page }) => {
  await page.goto('/inscricao');
  await page.getByLabel(/Vou submeter trabalho/).check();
  await expect(page.getByLabel(/^Título do trabalho/)).toBeVisible();
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  await expect(page.getByText(/premiação|prêmio/i)).toHaveCount(0);
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click();
  await expect(page.locator('#titulo-erro')).toContainText('título');
  await expect(page.locator('#autores-erro')).toContainText('autores');
  await expect(page.locator('#resumo-erro')).toContainText('resumo');
});

test('vínculo é obrigatório e perfil só aceita LinkedIn ou Lattes', async ({ page }) => {
  await page.goto('/inscricao');
  await page.locator('#perfil').fill('https://evil.com/in/ana');
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click();
  await expect(page.locator('#vinculo-erro')).toContainText('vínculo');
  await expect(page.locator('#vinculo')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#perfil-erro')).toContainText('LinkedIn');
  await page.locator('#perfil').fill('lattes.cnpq.br/1234567890123456');
  await page.locator('#vinculo').getByText('Estudante').click();
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click();
  await expect(page.locator('#perfil-erro')).toBeEmpty();
  await expect(page.locator('#vinculo-erro')).toBeEmpty();
});

test('ordem: instituição, vínculo, curso e perfil', async ({ page }) => {
  await page.goto('/inscricao');
  const ordem = await page
    .locator('#instituicao, #vinculo, #curso, #perfil')
    .evaluateAll((els) => els.map((e) => e.id));
  expect(ordem).toEqual(['instituicao', 'vinculo', 'curso', 'perfil']);
});

test('"Outro" pede o vínculo em texto livre (até 40 caracteres)', async ({ page }) => {
  await page.goto('/inscricao');
  const qual = page.locator('#vinculo_outro');
  // Oculto: fora da tela, do leitor de tela e da ordem do teclado.
  await expect(qual).toBeHidden();

  await page.locator('#vinculo').getByText('Outro').click();
  await expect(page.getByLabel(/^Qual vínculo\?/)).toBeVisible();
  await expect(qual).toHaveAttribute('required', '');
  await expect(qual).toHaveAttribute('maxlength', '40');
  await expect(qual).toHaveAttribute('aria-describedby', /vinculo_outro-erro/);

  await page.getByRole('button', { name: 'Confirmar inscrição' }).click();
  await expect(page.locator('#vinculo_outro-erro')).toContainText('40 caracteres');
  await expect(qual).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#vinculo-erro')).toBeEmpty();

  await qual.fill('Servidor técnico');
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click();
  await expect(page.locator('#vinculo_outro-erro')).toBeEmpty();

  // Trocar de opção esconde e limpa o campo.
  await page.locator('#vinculo').getByText('Estudante').click();
  await expect(qual).toBeHidden();
  await page.locator('#vinculo').getByText('Outro').click();
  await expect(qual).toHaveValue('');
});

test('acervo de edições passadas: caixa opcional, desmarcada, só com trabalho (WML-73)', async ({
  page,
}) => {
  await page.goto('/inscricao');
  const acervo = page.getByLabel(/Autorizo manter meu trabalho/);
  await expect(acervo).toBeHidden();
  await page.getByLabel(/Vou submeter trabalho/).check();
  await expect(acervo).toBeVisible();
  await expect(acervo).not.toBeChecked();
  await expect(acervo).toHaveAttribute('name', 'acervo');
  await expect(acervo).toHaveAttribute('value', 'sim');
  await expect(acervo).not.toHaveAttribute('required');
  await expect(page.locator('#acervo-dica')).toContainText('não entra no acervo');
  await expect(page.locator('#acervo-dica')).not.toContainText('PDF');
  // Vem depois de título, autores e resumo, dentro do bloco do trabalho (sem PDF nem prêmio, WML-75).
  const ordem = await page
    .locator('#campos-trabalho')
    .locator('#titulo, #autores, #resumo, #acervo')
    .evaluateAll((els) => els.map((e) => e.id));
  expect(ordem).toEqual(['titulo', 'autores', 'resumo', 'acervo']);
  // Teclado: foco e espaço marcam a caixa.
  await acervo.focus();
  await page.keyboard.press('Space');
  await expect(acervo).toBeChecked();
  // O opt-in não substitui o aceite da política: sem ele, o envio continua bloqueado.
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click();
  await expect(page.locator('#consentimento-erro')).not.toBeEmpty();
  const r = await new AxeBuilder({ page })
    .include('#campos-trabalho')
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
});

test('acervo cabe em 360 px sem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/inscricao');
  await page.getByLabel(/Vou submeter trabalho/).check();
  await expect(page.getByLabel(/Autorizo manter meu trabalho/)).toBeVisible();
  const [rolagem, largura] = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    window.innerWidth,
  ]);
  expect(rolagem).toBeLessThanOrEqual(largura);
});

test('campo "Qual vínculo?" com erro continua acessível (WCAG 2.2 AA)', async ({ page }) => {
  await page.goto('/inscricao');
  await page.locator('#vinculo').getByText('Outro').click();
  await page.getByRole('button', { name: 'Confirmar inscrição' }).click();
  await expect(page.locator('#vinculo_outro-erro')).not.toBeEmpty();
  const r = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
});
