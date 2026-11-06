// origem: skills-modelo/apps/api/src/exportacao/config-exportacao.spec.ts
import { describe, expect, it } from 'vitest';
import { carregarConfig } from '../config/config';

const base = (extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv => ({
  DATABASE_URL: 'postgres://dono:senha-do-dono@localhost:5432/app',
  ...extra,
});

describe('configuração da exportação', () => {
  it('padrão: no máximo 10.000 linhas e sem logo', () => {
    const c = carregarConfig(base());
    expect(c.EXPORTACAO_MAX_LINHAS).toBe(10_000);
    expect(c.EXPORTACAO_LOGO).toBeUndefined();
  });

  it('aceita outro limite e um caminho de logo', () => {
    const c = carregarConfig(base({ EXPORTACAO_MAX_LINHAS: '500', EXPORTACAO_LOGO: '/app/logo.png' }));
    expect(c.EXPORTACAO_MAX_LINHAS).toBe(500);
    expect(c.EXPORTACAO_LOGO).toBe('/app/logo.png');
  });

  it('recusa limite zero, negativo, fracionário ou acima de 100.000 (o arquivo é montado em memória)', () => {
    for (const ruim of ['0', '-1', '1.5', '100001', 'abc']) {
      expect(() => carregarConfig(base({ EXPORTACAO_MAX_LINHAS: ruim }))).toThrow(/EXPORTACAO_MAX_LINHAS/);
    }
  });
});
