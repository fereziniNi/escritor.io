import { type INestApplication } from '@nestjs/common';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { carregarConfig } from '../src/config/config';
import { criarApp } from '../src/criar-app';
import { EmailModule } from '../src/email/email.module';
import { ENVIADOR_EMAIL, EnviadorLog, EnviadorSmtp, type EnviadorEmail } from '../src/email/enviador-email';
import { montarEmail } from '../src/email/modelo-email';
import { ServicoEmail } from '../src/email/servico-email';
import { subirPostgres } from './postgres';

/** Mailpit (mesma versão do docker-compose.yml de dev): SMTP na 1025, API HTTP e interface na 8025. */
const IMAGEM_MAILPIT = 'axllent/mailpit:v1.31.6';

let mailpit: StartedTestContainer;
let smtpPorta: number;
let apiMailpit: string;
let urlBanco: string;
let pararBanco: () => Promise<void>;
const apps: INestApplication[] = [];

interface MensagemMailpit {
  ID: string;
  Subject: string;
  To: { Address: string }[];
  From: { Address: string };
}

async function mensagens(): Promise<MensagemMailpit[]> {
  const r = await fetch(`${apiMailpit}/api/v1/messages`);
  return ((await r.json()) as { messages: MensagemMailpit[] }).messages;
}

async function esperarMensagem(assunto: string): Promise<MensagemMailpit> {
  for (let i = 0; i < 50; i++) {
    const achada = (await mensagens()).find((m) => m.Subject === assunto);
    if (achada) return achada;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Mailpit não recebeu "${assunto}"`);
}

beforeAll(async () => {
  mailpit = await new GenericContainer(IMAGEM_MAILPIT)
    .withExposedPorts(1025, 8025)
    .withWaitStrategy(Wait.forHttp('/livez', 8025))
    .start();
  smtpPorta = mailpit.getMappedPort(1025);
  apiMailpit = `http://${mailpit.getHost()}:${mailpit.getMappedPort(8025)}`;
  ({ url: urlBanco, parar: pararBanco } = await subirPostgres());
});

afterAll(async () => {
  for (const app of apps) await app.close();
  await pararBanco?.();
  await mailpit?.stop();
});

describe('EnviadorSmtp contra o Mailpit', () => {
  it('entrega a mensagem com remetente, assunto e identidade visual', async () => {
    const enviador = new EnviadorSmtp({ host: mailpit.getHost(), port: smtpPorta, seguro: false, remetente: 'Sistema <nao-responda@exemplo.com.br>' });
    const { html, texto } = montarEmail('Bem-vinda', '<p>Seu acesso foi criado.</p>');
    await enviador.enviar({ para: 'ana@exemplo.com.br', assunto: 'e2e-entrega', html, texto });

    const msg = await esperarMensagem('e2e-entrega');
    expect(msg.To[0]?.Address).toBe('ana@exemplo.com.br');
    expect(msg.From.Address).toBe('nao-responda@exemplo.com.br');
    const detalhe = (await (await fetch(`${apiMailpit}/api/v1/message/${msg.ID}`)).json()) as { HTML: string; Text: string };
    expect(detalhe.HTML).toContain('#2F6FED');
    expect(detalhe.Text).toContain('Seu acesso foi criado.');
    expect(detalhe.Text).not.toMatch(/<[^>]+>/);
  });
});

describe('módulo de e-mail na aplicação', () => {
  async function subirApi(extra: Record<string, string>): Promise<INestApplication> {
    const config = carregarConfig({ DATABASE_URL: urlBanco, NODE_ENV: 'test', LOG_LEVEL: 'silent', ...extra });
    const app = await criarApp(config);
    await app.init();
    apps.push(app);
    return app;
  }

  it('MAIL_MODE=log usa o EnviadorLog', async () => {
    const app = await subirApi({ MAIL_MODE: 'log' });
    expect(app.select(EmailModule).get<EnviadorEmail>(ENVIADOR_EMAIL)).toBeInstanceOf(EnviadorLog);
  });

  it('MAIL_MODE=smtp usa o EnviadorSmtp e o ServicoEmail entrega pelo Mailpit', async () => {
    const app = await subirApi({
      MAIL_MODE: 'smtp',
      SMTP_HOST: mailpit.getHost(),
      SMTP_PORT: String(smtpPorta),
      EMAIL_REMETENTE: 'Sistema <nao-responda@exemplo.com.br>',
    });
    const modulo = app.select(EmailModule);
    expect(modulo.get<EnviadorEmail>(ENVIADOR_EMAIL)).toBeInstanceOf(EnviadorSmtp);
    await modulo.get(ServicoEmail).enviar({ para: 'bia@exemplo.com.br', assunto: 'e2e-servico', html: '<p>oi</p>', texto: 'oi' });
    expect((await esperarMensagem('e2e-servico')).To[0]?.Address).toBe('bia@exemplo.com.br');
  });

  it('disparar() nunca lança nem espera: SMTP fora do ar não derruba quem chamou', async () => {
    const app = await subirApi({ MAIL_MODE: 'smtp', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', EMAIL_REMETENTE: 'Sistema <nao-responda@exemplo.com.br>' });
    const servico = app.select(EmailModule).get(ServicoEmail);
    const inicio = Date.now();
    expect(() => servico.disparar({ para: 'cris@exemplo.com.br', assunto: 'x', html: '<p>x</p>', texto: 'x' })).not.toThrow();
    expect(Date.now() - inicio).toBeLessThan(200);
  });
});
