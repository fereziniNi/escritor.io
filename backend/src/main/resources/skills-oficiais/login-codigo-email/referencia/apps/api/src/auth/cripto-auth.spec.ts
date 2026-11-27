// origem: skills-modelo/apps/api/src/auth/cripto-auth.spec.ts
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { codigoComZeros, gerarCodigo, hashToken, hmacCodigo, hmacIguais, novoToken } from './cripto-auth';

const SEGREDO = 'segredo-de-teste-com-mais-de-32-caracteres';

describe('código de acesso', () => {
  it('sempre 6 dígitos (randomInt de 0 a 999999)', () => {
    for (let i = 0; i < 500; i++) expect(gerarCodigo()).toMatch(/^\d{6}$/);
  });

  it('número pequeno ganha zeros à esquerda', () => {
    expect(codigoComZeros(0)).toBe('000000');
    expect(codigoComZeros(7)).toBe('000007');
    expect(codigoComZeros(999_999)).toBe('999999');
  });

  it('HMAC-SHA256 ligado ao e-mail: mesmo código em outro e-mail dá outro HMAC; o código não aparece no resultado', () => {
    const a = hmacCodigo(SEGREDO, 'ana@exemplo.com.br', '123456');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(hmacCodigo(SEGREDO, 'ana@exemplo.com.br', '123456'));
    expect(a).not.toBe(hmacCodigo(SEGREDO, 'beto@exemplo.com.br', '123456'));
    expect(a).not.toBe(hmacCodigo('outro-segredo-com-mais-de-32-caracteres!!', 'ana@exemplo.com.br', '123456'));
    expect(a).not.toContain('123456');
  });

  it('comparação em tempo constante: iguais, diferentes e tamanhos diferentes', () => {
    const a = hmacCodigo(SEGREDO, 'ana@exemplo.com.br', '123456');
    expect(hmacIguais(a, a)).toBe(true);
    expect(hmacIguais(a, hmacCodigo(SEGREDO, 'ana@exemplo.com.br', '654321'))).toBe(false);
    expect(hmacIguais(a, 'abc')).toBe(false);
  });
});

describe('token de sessão', () => {
  it('randomBytes(32) em base64url (43 caracteres), um diferente a cada chamada', () => {
    const t = novoToken();
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Buffer.from(t, 'base64url')).toHaveLength(32);
    expect(novoToken()).not.toBe(t);
  });

  it('no banco vai só o SHA-256 em hex', () => {
    const t = novoToken();
    expect(hashToken(t)).toBe(createHash('sha256').update(t).digest('hex'));
    expect(hashToken(t)).not.toContain(t);
  });
});
