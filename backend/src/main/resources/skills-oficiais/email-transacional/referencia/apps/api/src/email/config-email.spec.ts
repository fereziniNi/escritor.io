// origem: skills-modelo/apps/api/src/email/config-email.spec.ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { ErroConfiguracao, carregarConfig } from '../config/config';
import { Segredo } from '../config/segredo';

const base = (extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv => ({
  DATABASE_URL: 'postgres://app:senha-de-teste@localhost:5432/app',
  ...extra,
});

const smtp = {
  MAIL_MODE: 'smtp',
  SMTP_HOST: 'smtp.exemplo.com.br',
  EMAIL_REMETENTE: 'Sistema <nao-responda@exemplo.com.br>',
};

describe('configuração de e-mail', () => {
  it('padrão: MAIL_MODE=log, porta 587, sem TLS implícito', () => {
    const c = carregarConfig(base());
    expect(c.MAIL_MODE).toBe('log');
    expect(c.SMTP_PORT).toBe(587);
    expect(c.SMTP_SEGURO).toBe(false);
  });

  it('MAIL_MODE=log com NODE_ENV=production lança, citando MAIL_MODE', () => {
    const env = base({ NODE_ENV: 'production', MAIL_MODE: 'log' });
    expect(() => carregarConfig(env)).toThrow(ErroConfiguracao);
    expect(() => carregarConfig(env)).toThrow(/MAIL_MODE/);
  });

  it('em produção sem MAIL_MODE (padrão log) também lança', () => {
    expect(() => carregarConfig(base({ NODE_ENV: 'production' }))).toThrow(/MAIL_MODE/);
  });

  it('MAIL_MODE desconhecido lança', () => {
    expect(() => carregarConfig(base({ MAIL_MODE: 'memoria' }))).toThrow(/MAIL_MODE/);
  });

  it('smtp exige SMTP_HOST e EMAIL_REMETENTE, listando os dois', () => {
    try {
      carregarConfig(base({ MAIL_MODE: 'smtp' }));
      expect.unreachable('deveria ter falhado');
    } catch (e) {
      const texto = (e as ErroConfiguracao).problemas.join('\n');
      expect(texto).toMatch(/SMTP_HOST/);
      expect(texto).toMatch(/EMAIL_REMETENTE/);
    }
  });

  it('smtp completo em produção é aceito; a senha é Segredo (nunca aparece em JSON nem inspect)', () => {
    const c = carregarConfig(
      base({ NODE_ENV: 'production', ...smtp, SMTP_PORT: '465', SMTP_SEGURO: 'true', SMTP_USUARIO: 'apikey', SMTP_SENHA: 'senha-smtp-secreta' }),
    );
    expect(c.MAIL_MODE).toBe('smtp');
    expect(c.SMTP_PORT).toBe(465);
    expect(c.SMTP_SEGURO).toBe(true);
    expect(c.SMTP_SENHA).toBeInstanceOf(Segredo);
    expect(c.SMTP_SENHA?.revelar()).toBe('senha-smtp-secreta');
    expect(JSON.stringify(c)).not.toContain('senha-smtp-secreta');
    expect(inspect(c)).not.toContain('senha-smtp-secreta');
  });

  it('SMTP_USUARIO sem SMTP_SENHA (ou o contrário) lança', () => {
    expect(() => carregarConfig(base({ ...smtp, SMTP_USUARIO: 'apikey' }))).toThrow(/SMTP_SENHA/);
    expect(() => carregarConfig(base({ ...smtp, SMTP_SENHA: 'x' }))).toThrow(/SMTP_USUARIO/);
  });

  it('SMTP_SENHA_ARQUIVO lê a senha do arquivo', () => {
    const pasta = mkdtempSync(path.join(tmpdir(), 'smtp-'));
    try {
      const arquivo = path.join(pasta, 'smtp_senha');
      writeFileSync(arquivo, 'senha-do-arquivo\n');
      const c = carregarConfig(base({ ...smtp, SMTP_USUARIO: 'apikey', SMTP_SENHA_ARQUIVO: arquivo }));
      expect(c.SMTP_SENHA?.revelar()).toBe('senha-do-arquivo');
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });

  it('EMAIL_REMETENTE com quebra de linha (injeção de cabeçalho) lança', () => {
    expect(() => carregarConfig(base({ ...smtp, EMAIL_REMETENTE: 'a@exemplo.com.br\nBcc: x@y.com' }))).toThrow(/EMAIL_REMETENTE/);
  });

  it('porta 465 com SMTP_SEGURO=false lança (TLS direto é obrigatório nela)', () => {
    expect(() => carregarConfig(base({ ...smtp, SMTP_PORT: '465' }))).toThrow(/SMTP_SEGURO/);
    expect(carregarConfig(base({ ...smtp, SMTP_PORT: '465', SMTP_SEGURO: 'true' })).SMTP_SEGURO).toBe(true);
  });

  it('porta 25 sem TLS é recusada em produção, mas aceita em desenvolvimento', () => {
    expect(() => carregarConfig(base({ NODE_ENV: 'production', ...smtp, SMTP_PORT: '25' }))).toThrow(/SMTP_PORT/);
    expect(carregarConfig(base({ ...smtp, SMTP_PORT: '25' })).SMTP_PORT).toBe(25);
  });

  it('SMTP_SEGURO só aceita true ou false', () => {
    expect(() => carregarConfig(base({ ...smtp, SMTP_SEGURO: 'sim' }))).toThrow(/SMTP_SEGURO/);
  });
});
