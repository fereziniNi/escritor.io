// origem: skills-modelo/packages/contratos/src/usuarios.spec.ts
import { describe, expect, it } from 'vitest';
import { PAPEIS, esquemaListaUsuarios, esquemaUsuario } from './usuarios.js';

const valido = { id: '2c8a8f3e-6f5b-4c5e-9d0f-6a1a3f7b9c11', email: 'ana@exemplo.com.br', nome: 'Ana', papel: 'ADMIN', ativo: true, criadoEm: '2026-11-05T12:00:00.000Z' };

describe('contratos de usuários', () => {
  it('papéis são os três do enum, em maiúsculas', () => {
    expect(PAPEIS).toEqual(['ADMIN', 'GESTOR', 'USUARIO']);
  });

  it('aceita um usuário válido e uma lista', () => {
    expect(esquemaUsuario.parse(valido)).toEqual(valido);
    expect(esquemaListaUsuarios.parse([valido])).toHaveLength(1);
  });

  it('recusa papel em minúsculas ou desconhecido', () => {
    expect(esquemaUsuario.safeParse({ ...valido, papel: 'admin' }).success).toBe(false);
    expect(esquemaUsuario.safeParse({ ...valido, papel: 'SUPER' }).success).toBe(false);
  });
});
