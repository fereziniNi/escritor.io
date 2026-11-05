// origem: skills-modelo/apps/web/e2e/inicio.spec.ts
import { expect, test } from '@playwright/test';

test('a tela inicial mostra a versão que a API informa', async ({ page }) => {
  await page.route('**/api/health', (rota) =>
    rota.fulfill({ json: { status: 'ok', banco: 'ok', versao: '1.2.3', commit: 'abc1234' } }),
  );
  await page.goto('/sistema');
  await expect(page.getByText('API no ar')).toBeVisible();
  await expect(page.getByText('versão 1.2.3 (abc1234)')).toBeVisible();
});
