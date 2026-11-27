import { expect, test } from '@playwright/test';

test('a tela inicial mostra a versão que a API informa', async ({ page }) => {
  // As telas logadas pedem /api/auth/eu (skill login-codigo-email): simula uma administradora com sessão.
  await page.route('**/api/auth/eu', (rota) =>
    rota.fulfill({ json: { id: '2c8a8f3e-6f5b-4c5e-9d0f-6a1a3f7b9c11', email: 'ana@exemplo.com.br', nome: 'Ana Souza', papel: 'ADMIN' } }),
  );
  await page.route('**/api/health', (rota) =>
    rota.fulfill({ json: { status: 'ok', banco: 'ok', versao: '1.2.3', commit: 'abc1234' } }),
  );
  await page.goto('/sistema');
  await expect(page.getByText('API no ar')).toBeVisible();
  await expect(page.getByText('versão 1.2.3 (abc1234)')).toBeVisible();
});

test('sem sessão, a área logada leva à tela de entrada', async ({ page }) => {
  await page.route('**/api/auth/eu', (rota) => rota.fulfill({ status: 401, json: { status: 401, erro: 'Não autenticado' } }));
  await page.goto('/');
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(page.getByLabel('E-mail')).toBeVisible();
});
