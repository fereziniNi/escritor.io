// origem: skills-modelo/packages/contratos/src/auth.spec.ts
import { describe, expect, it } from 'vitest';
import { RESPOSTA_PEDIR_CODIGO, esquemaEntrar, esquemaPedirCodigo, esquemaUsuarioLogado } from './auth.js';

describe('contratos do login', () => {
  it('pedir código: e-mail sem espaços e em minúsculas', () => {
    expect(esquemaPedirCodigo.parse({ email: '  Ana@Exemplo.com.br ' })).toEqual({ email: 'ana@exemplo.com.br' });
    expect(esquemaPedirCodigo.safeParse({ email: 'nao-e-email' }).success).toBe(false);
    expect(esquemaPedirCodigo.safeParse({}).success).toBe(false);
  });

  it('entrar: código de exatamente 6 dígitos (zeros à esquerda contam)', () => {
    expect(esquemaEntrar.parse({ email: 'ana@exemplo.com.br', codigo: '012345' })).toEqual({ email: 'ana@exemplo.com.br', codigo: '012345' });
    for (const codigo of ['12345', '1234567', 'abcdef', ' 123456', 123456]) {
      expect(esquemaEntrar.safeParse({ email: 'ana@exemplo.com.br', codigo }).success).toBe(false);
    }
  });

  it('usuário logado: id, e-mail, nome e papel do enum', () => {
    const u = { id: '2c8a8f3e-6f5b-4c5e-9d0f-6a1a3f7b9c11', email: 'ana@exemplo.com.br', nome: 'Ana', papel: 'GESTOR' };
    expect(esquemaUsuarioLogado.parse(u)).toEqual(u);
    expect(esquemaUsuarioLogado.safeParse({ ...u, papel: 'gestor' }).success).toBe(false);
  });

  it('a resposta do pedido de código não diz se o e-mail tem acesso', () => {
    expect(RESPOSTA_PEDIR_CODIGO.mensagem).toMatch(/^Se o e-mail/);
  });
});
