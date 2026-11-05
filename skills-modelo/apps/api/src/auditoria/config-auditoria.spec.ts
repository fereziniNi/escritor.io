import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { carregarConfig } from '../config/config';
import { Segredo } from '../config/segredo';
import { exigirPapelRuntime } from './papel-runtime';

const base = (extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv => ({
  DATABASE_URL: 'postgres://dono:senha-do-dono@localhost:5432/app',
  ...extra,
});

describe('configuração da auditoria: dois papéis de banco', () => {
  it('DATABASE_URL_RUNTIME é opcional (em dev, o mesmo usuário serve)', () => {
    expect(carregarConfig(base()).DATABASE_URL_RUNTIME).toBeUndefined();
  });

  it('é Segredo (tem senha) e nunca aparece ao inspecionar a config', () => {
    const c = carregarConfig(base({ DATABASE_URL_RUNTIME: 'postgres://app_runtime:senha-runtime@localhost:5432/app' }));
    expect(c.DATABASE_URL_RUNTIME).toBeInstanceOf(Segredo);
    expect(c.DATABASE_URL_RUNTIME?.revelar()).toContain('app_runtime');
    expect(inspect(c)).not.toContain('senha-runtime');
    expect(JSON.stringify(c)).not.toContain('senha-runtime');
  });

  it('recusa valor que não é URL postgres', () => {
    expect(() => carregarConfig(base({ DATABASE_URL_RUNTIME: 'mysql://x' }))).toThrow(/DATABASE_URL_RUNTIME/);
  });
  it('recusa DATABASE_URL_RUNTIME com o mesmo usuário de DATABASE_URL (o REVOKE não valeria nada para o dono)', () => {
    expect(() =>
      carregarConfig(base({ DATABASE_URL_RUNTIME: 'postgres://dono:outra-senha@outro-host:5432/app' })),
    ).toThrow(/mesmo usuário/);
    // comparação sem diferenciar a forma de escrever o usuário (codificação de URL)
    expect(() => carregarConfig(base({ DATABASE_URL_RUNTIME: 'postgres://%64ono:x@localhost:5432/app' }))).toThrow(/mesmo usuário/);
  });
});

describe('exigirPapelRuntime: falha fechada fora de desenvolvimento', () => {
  // Produção exige e-mail real (MAIL_MODE=smtp); o resto da config não interessa a estes testes.
  const smtp = { MAIL_MODE: 'smtp', SMTP_HOST: 'smtp.exemplo.com.br', EMAIL_REMETENTE: 'nao-responda@exemplo.com.br' };
  const runtime = { DATABASE_URL_RUNTIME: 'postgres://app_runtime:senha-runtime@localhost:5432/app' };

  it('produção sem DATABASE_URL_RUNTIME → recusa subir, dizendo o motivo', () => {
    expect(() => exigirPapelRuntime(carregarConfig(base({ NODE_ENV: 'production', ...smtp })))).toThrow(/DATABASE_URL_RUNTIME/);
  });

  it('NODE_ENV ausente ou vazio conta como produção (como no login)', () => {
    expect(() => exigirPapelRuntime(carregarConfig(base()))).toThrow(/DATABASE_URL_RUNTIME/);
    expect(() => exigirPapelRuntime(carregarConfig(base({ NODE_ENV: '' })))).toThrow(/DATABASE_URL_RUNTIME/);
  });

  it('a mensagem não revela a URL do dono', () => {
    try {
      exigirPapelRuntime(carregarConfig(base({ NODE_ENV: 'production', ...smtp })));
      expect.unreachable();
    } catch (e) {
      expect((e as Error).message).not.toContain('senha-do-dono');
    }
  });

  it('development e test DECLARADOS podem usar o dono; produção com o runtime sobe', () => {
    expect(() => exigirPapelRuntime(carregarConfig(base({ NODE_ENV: 'development' })))).not.toThrow();
    expect(() => exigirPapelRuntime(carregarConfig(base({ NODE_ENV: 'test' })))).not.toThrow();
    expect(() => exigirPapelRuntime(carregarConfig(base({ NODE_ENV: 'production', ...smtp, ...runtime })))).not.toThrow();
    expect(() => exigirPapelRuntime(carregarConfig(base({ ...smtp, ...runtime })))).not.toThrow();
  });
});
