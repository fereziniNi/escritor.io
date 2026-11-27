// origem: skills-modelo/apps/web/e2e/login-real.config.ts
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Login de ponta a ponta DE VERDADE (sem simular a API): a API compilada aplica as migrações, sobe servindo o build da
// web e manda o código pelo SMTP de um Mailpit; o teste APAGA a caixa do Mailpit e entra com ADMIN_INICIAL_EMAIL.
// Por isso roda só contra Postgres e Mailpit DESCARTÁVEIS, informados de propósito (nunca cai no banco/caixa de dev):
//   docker run -d --rm --name e2e-pg -e POSTGRES_USER=app -e POSTGRES_PASSWORD=app -e POSTGRES_DB=app -p 127.0.0.1:55432:5432 postgres:16-alpine
//   docker run -d --rm --name e2e-mailpit -p 127.0.0.1:51025:1025 -p 127.0.0.1:58025:8025 axllent/mailpit:v1.31.6
//   pnpm build   (na raiz)
//   E2E_DATABASE_URL=postgres://app:app@localhost:55432/app E2E_SMTP_PORTA=51025 E2E_URL_MAILPIT=http://localhost:58025 \
//     pnpm exec playwright test -c e2e/login-real.config.ts   (em apps/web)
//   docker rm -f e2e-pg e2e-mailpit
// Opcionais: E2E_PORTA_API (padrão 3100), E2E_EMAIL (padrão admin@exemplo.com.br).
const OBRIGATORIAS = ['E2E_DATABASE_URL', 'E2E_SMTP_PORTA', 'E2E_URL_MAILPIT'] as const;
const faltando = OBRIGATORIAS.filter((v) => !process.env[v]);
if (faltando.length > 0) {
  throw new Error(
    `login-real: defina ${faltando.join(', ')} apontando para Postgres e Mailpit descartáveis ` +
      '(o teste apaga a caixa do Mailpit e cria o administrador). Veja o comentário no topo de e2e/login-real.config.ts.',
  );
}
const porta = process.env['E2E_PORTA_API'] ?? '3100';
process.env['E2E_LOGIN_REAL'] = '1';

export default defineConfig({
  testDir: '.',
  testMatch: 'login-real.spec.ts',
  use: { baseURL: `http://localhost:${porta}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node dist/banco/executar-migracoes.js && node dist/main.js',
    cwd: path.resolve(import.meta.dirname, '../../api'),
    url: `http://localhost:${porta}/api/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      // development: em http://localhost o cookie é "sessao" sem Secure (em produção é __Host-sessao com Secure).
      NODE_ENV: 'development',
      PORT: porta,
      LOG_LEVEL: 'warn',
      DATABASE_URL: process.env['E2E_DATABASE_URL']!,
      MAIL_MODE: 'smtp',
      SMTP_HOST: 'localhost',
      SMTP_PORT: process.env['E2E_SMTP_PORTA']!,
      EMAIL_REMETENTE: 'Sistema <nao-responda@exemplo.com.br>',
      WEB_DIST: path.resolve(import.meta.dirname, '../dist'),
      ADMIN_INICIAL_EMAIL: process.env['E2E_EMAIL'] ?? 'admin@exemplo.com.br',
      AUTH_DOMINIOS_PERMITIDOS: 'exemplo.com.br',
    },
  },
});
