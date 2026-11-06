// origem: skills-modelo/apps/api/test/fila-app.e2e.spec.ts
import { type INestApplication } from '@nestjs/common';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { carregarConfig } from '../src/config/config';
import { criarApp } from '../src/criar-app';
import { ServicoEmail } from '../src/email/servico-email';
import { AlertaFalhaPorEmail } from '../src/fila/alerta-falha';
import { Fila } from '../src/fila/fila';
import { criarFila } from '../src/fila/fila.module';
import { prepararFila } from '../src/fila/preparar-fila';
import { subirPostgres } from './postgres';

const IMAGEM_MAILPIT = 'axllent/mailpit:v1.31.6';

let mailpit: StartedTestContainer;
let apiMailpit: string;
let urlDono: string;
let urlRuntime: string;
let pararBanco: () => Promise<void>;
const apps: INestApplication[] = [];

interface MensagemMailpit {
  ID: string;
  Subject: string;
  To: { Address: string }[];
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function mensagens(): Promise<MensagemMailpit[]> {
  return ((await (await fetch(`${apiMailpit}/api/v1/messages`)).json()) as { messages: MensagemMailpit[] }).messages;
}

async function esperarMensagem(assunto: string, ms = 20_000): Promise<MensagemMailpit> {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    const achada = (await mensagens()).find((m) => m.Subject === assunto);
    if (achada) return achada;
    await dormir(200);
  }
  throw new Error(`Mailpit não recebeu "${assunto}"`);
}

async function subirApi(extra: Record<string, string>): Promise<INestApplication> {
  const config = carregarConfig({
    DATABASE_URL: urlDono,
    DATABASE_URL_RUNTIME: urlRuntime,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    MAIL_MODE: 'smtp',
    SMTP_HOST: mailpit.getHost(),
    SMTP_PORT: String(mailpit.getMappedPort(1025)),
    EMAIL_REMETENTE: 'Sistema <nao-responda@exemplo.com.br>',
    ...extra,
  });
  const app = await criarApp(config);
  await app.init();
  apps.push(app);
  return app;
}

beforeAll(async () => {
  mailpit = await new GenericContainer(IMAGEM_MAILPIT).withExposedPorts(1025, 8025).withWaitStrategy(Wait.forHttp('/livez', 8025)).start();
  apiMailpit = `http://${mailpit.getHost()}:${mailpit.getMappedPort(8025)}`;
  ({ url: urlDono, urlRuntime, parar: pararBanco } = await subirPostgres());
  await prepararFila(urlDono, { conceder: true });
});

afterEach(async () => {
  while (apps.length > 0) await apps.pop()!.close();
});

afterAll(async () => {
  await pararBanco?.();
  await mailpit?.stop();
});

describe('e-mail pela fila', () => {
  it('disparar() grava na fila e o worker entrega pelo SMTP (Mailpit)', async () => {
    const app = await subirApi({ ROLE: 'tudo' });
    app.get(ServicoEmail).disparar({ para: 'ana@exemplo.com.br', assunto: 'fila-entrega', html: '<p>oi</p>', texto: 'oi' });
    expect((await esperarMensagem('fila-entrega')).To[0]?.Address).toBe('ana@exemplo.com.br');
  });

  it('disparar() com a mesma chave duas vezes entrega uma mensagem só', async () => {
    const app = await subirApi({ ROLE: 'tudo' });
    const servico = app.get(ServicoEmail);
    const m = { para: 'bia@exemplo.com.br', assunto: 'fila-chave', html: '<p>oi</p>', texto: 'oi' };
    servico.disparar(m, { chave: 'convite-bia' });
    servico.disparar(m, { chave: 'convite-bia' });
    await esperarMensagem('fila-chave');
    await dormir(2500);
    expect((await mensagens()).filter((x) => x.Subject === 'fila-chave')).toHaveLength(1);
  });

  it('ROLE=api só enfileira; o e-mail sai quando um worker sobe', async () => {
    const api = await subirApi({ ROLE: 'api' });
    api.get(ServicoEmail).disparar({ para: 'cris@exemplo.com.br', assunto: 'fila-api-worker', html: '<p>oi</p>', texto: 'oi' });
    await dormir(3500);
    expect((await mensagens()).some((x) => x.Subject === 'fila-api-worker')).toBe(false);
    await subirApi({ ROLE: 'worker', ALERTA_EMAIL: 'ti@grupomultiplica.com.br' });
    expect((await esperarMensagem('fila-api-worker')).To[0]?.Address).toBe('cris@exemplo.com.br');
  });

  const producao = { DATABASE_URL: 'postgres://app:senha@localhost:5432/app', NODE_ENV: 'production', MAIL_MODE: 'smtp', SMTP_HOST: 'smtp.exemplo.com.br', EMAIL_REMETENTE: 'a@exemplo.com.br' };

  it('sem ROLE e sem NODE_ENV de desenvolvimento a fila não é criada (a aplicação não sobe)', () => {
    expect(() => criarFila(carregarConfig(producao))).toThrow(/ROLE/);
  });

  it('worker em produção sem ALERTA_EMAIL não sobe', () => {
    expect(() => criarFila(carregarConfig({ ...producao, ROLE: 'worker' }))).toThrow(/ALERTA_EMAIL/);
  });
});

describe('alerta de falha definitiva', () => {
  it('vai para ALERTA_EMAIL com tarefa, id e tentativas, sem payload', async () => {
    const app = await subirApi({ ROLE: 'worker', ALERTA_EMAIL: 'ti@grupomultiplica.com.br' });
    await app.get(AlertaFalhaPorEmail).avisar({ tarefa: 'email-enviar', jobId: 'job-123', tentativas: 5, tipoErro: 'Error' });
    const msg = await esperarMensagem('Falha definitiva em tarefa da fila');
    expect(msg.To[0]?.Address).toBe('ti@grupomultiplica.com.br');
    const detalhe = (await (await fetch(`${apiMailpit}/api/v1/message/${msg.ID}`)).json()) as { Text: string };
    expect(detalhe.Text).toContain('email-enviar');
    expect(detalhe.Text).toContain('job-123');
    expect(detalhe.Text).not.toContain('@exemplo.com.br');
  });

  it('a fila do módulo aponta o alerta para o e-mail (definirAlerta ligado)', async () => {
    const app = await subirApi({ ROLE: 'worker', ALERTA_EMAIL: 'ti@grupomultiplica.com.br' });
    expect(app.get(Fila)).toBeInstanceOf(Fila);
  });
});
