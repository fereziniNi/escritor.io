import { describe, expect, it } from 'vitest';
import { REDACTED, mascararEmail, sanitizarDetalhes } from './sanitizar';

describe('sanitizarDetalhes: nunca guardar código, token, cookie, senha ou segredo', () => {
  it('troca por [REDACTED] o valor de chaves sensíveis, em qualquer nível e em listas', () => {
    const saida = sanitizarDetalhes({
      papel: 'ADMIN',
      codigo: '123456',
      Token: 'abc',
      sessao: { hash_token: 'x', cookie: '__Host-sessao=abc', ok: true },
      itens: [{ senha: 'p', nome: 'ok' }],
      AUTH_SEGREDO_CODIGO: 's',
      hmac: 'h',
      authorization: 'Bearer x',
    });
    expect(saida).toEqual({
      papel: 'ADMIN',
      codigo: REDACTED,
      Token: REDACTED,
      sessao: { hash_token: REDACTED, cookie: REDACTED, ok: true },
      itens: [{ senha: REDACTED, nome: 'ok' }],
      AUTH_SEGREDO_CODIGO: REDACTED,
      hmac: REDACTED,
      authorization: REDACTED,
    });
  });

  it('mantém números, booleanos e nulos; remove undefined; devolve null para ausência', () => {
    expect(sanitizarDetalhes({ a: 1, b: false, c: null, d: undefined })).toEqual({ a: 1, b: false, c: null });
    expect(sanitizarDetalhes(undefined)).toBeNull();
    expect(sanitizarDetalhes(null)).toBeNull();
  });

  it('corta texto longo, profundidade excessiva e converte Date em texto ISO', () => {
    const longo = sanitizarDetalhes({ obs: 'x'.repeat(2000) }) as { obs: string };
    expect(longo.obs.length).toBeLessThan(600);
    let fundo: unknown = 'fim';
    for (let i = 0; i < 20; i++) fundo = { n: fundo };
    expect(JSON.stringify(sanitizarDetalhes(fundo))).toContain('[profundo demais]');
    expect(sanitizarDetalhes({ quando: new Date('2026-11-05T12:00:00.000Z') })).toEqual({ quando: '2026-11-05T12:00:00.000Z' });
  });

  it('referência circular não trava', () => {
    const a: Record<string, unknown> = { x: 1 };
    a['self'] = a;
    expect(() => sanitizarDetalhes(a)).not.toThrow();
  });
});

describe('mascararEmail', () => {
  it('mantém a 1ª letra e o domínio', () => {
    expect(mascararEmail('ana.souza@grupomultiplica.com.br')).toBe('a***@grupomultiplica.com.br');
  });
  it('formato estranho vira ***', () => {
    expect(mascararEmail('sem-arroba')).toBe('***');
    expect(mascararEmail('')).toBe('***');
    expect(mascararEmail('@x.com')).toBe('***');
  });
});
