import { type APIRequestContext, expect, test } from '@playwright/test';

// Roda só com e2e/login-real.config.ts (API, Postgres e Mailpit de verdade). No `pnpm e2e` comum fica de fora.
test.skip(!process.env['E2E_LOGIN_REAL'], 'precisa de API, Postgres e Mailpit: pnpm exec playwright test -c e2e/login-real.config.ts');

const EMAIL = process.env['E2E_EMAIL'] ?? 'admin@exemplo.com.br';
const MAILPIT = process.env['E2E_URL_MAILPIT'] ?? 'http://localhost:8025';

interface MensagemMailpit {
  ID: string;
  Subject: string;
  To: { Address: string }[];
}

/** Espera o e-mail "Seu código de acesso" chegar ao Mailpit e devolve o código de 6 dígitos do texto. */
async function codigoDoMailpit(api: APIRequestContext): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const { messages } = (await (await api.get(`${MAILPIT}/api/v1/messages`)).json()) as { messages: MensagemMailpit[] };
    const m = messages.find((x) => x.Subject === 'Seu código de acesso' && x.To.some((t) => t.Address === EMAIL));
    if (m) {
      const { Text } = (await (await api.get(`${MAILPIT}/api/v1/message/${m.ID}`)).json()) as { Text: string };
      const achado = /\b(\d{6})\b/.exec(Text);
      if (achado) return achado[1]!;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`o Mailpit não recebeu o código para ${EMAIL}`);
}

test('login de verdade: código por e-mail, sessão em cookie HttpOnly, papel da API e sair', async ({ page, request, context }) => {
  await request.delete(`${MAILPIT}/api/v1/messages`);

  // Sem sessão: a área logada leva para /entrar.
  await page.goto('/');
  await expect(page).toHaveURL(/\/entrar$/);
  await page.getByLabel('E-mail').fill(EMAIL);
  await page.getByRole('button', { name: 'Receber código' }).click();
  await expect(page.getByRole('status')).toContainText('Se o e-mail tiver acesso');

  const codigo = await codigoDoMailpit(request);

  // Código errado: mensagem genérica, continua na tela.
  await page.getByLabel('Código').fill(codigo === '000000' ? '111111' : '000000');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toHaveText('Código inválido ou expirado');

  // Código certo: entra; o menu Admin aparece porque o papel ADMIN veio de /api/auth/eu.
  await page.getByLabel('Código').fill(codigo);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('link', { name: 'Usuários' })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/');

  // O cookie existe, é HttpOnly e SameSite=Lax, e o JavaScript da página não o enxerga.
  const sessao = (await context.cookies()).find((c) => c.name === 'sessao');
  expect(sessao?.httpOnly).toBe(true);
  expect(sessao?.sameSite).toBe('Lax');
  expect(await page.evaluate(() => document.cookie)).not.toContain('sessao=');

  // Tela de usuários (skill usuarios-e-papeis) funciona com a sessão de verdade.
  await page.getByRole('link', { name: 'Usuários' }).click();
  await expect(page.getByRole('table').getByText(EMAIL)).toBeVisible();

  // Sair: revoga no servidor, apaga o cookie e volta para /entrar; a área logada não abre mais.
  await page.getByRole('button', { name: 'Sair' }).click();
  await expect(page).toHaveURL(/\/entrar$/);
  expect((await context.cookies()).find((c) => c.name === 'sessao')).toBeUndefined();
  await page.goto('/usuarios');
  await expect(page).toHaveURL(/\/entrar$/);
});
