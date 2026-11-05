// origem: skills-modelo/apps/api/src/auditoria/config-auditoria.spec.ts
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { carregarConfig } from '../config/config';
import { Segredo } from '../config/segredo';

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
});
