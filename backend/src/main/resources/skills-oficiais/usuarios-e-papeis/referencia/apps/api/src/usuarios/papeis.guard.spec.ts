// origem: skills-modelo/apps/api/src/usuarios/papeis.guard.spec.ts
import { type ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it } from 'vitest';
import { PAPEIS_CHAVE, Papeis, PapeisGuard } from './papeis.guard';
import { exigirPapel, type UsuarioAtual } from './usuario-atual';

const usuario = (papel: string): UsuarioAtual => ({ id: 'u1', email: 'ana@exemplo.com.br', nome: 'Ana', papel: papel as UsuarioAtual['papel'] });

const metodo = (nome: keyof RotaDeAdmin): (() => void) => Object.getOwnPropertyDescriptor(RotaDeAdmin.prototype, nome)!.value as () => void;

class RotaDeAdmin {
  @Papeis('ADMIN')
  rota() {}

  @Papeis('ADMIN', 'GESTOR')
  rotaDupla() {}
}

function contexto(nome: keyof RotaDeAdmin, u?: UsuarioAtual): ExecutionContext {
  return {
    getHandler: () => metodo(nome),
    getClass: () => RotaDeAdmin,
    switchToHttp: () => ({ getRequest: () => ({ usuario: u }) }),
  } as unknown as ExecutionContext;
}

describe('PapeisGuard', () => {
  const guard = new PapeisGuard(new Reflector());

  it('o decorator guarda os papéis exigidos', () => {
    expect(Reflect.getMetadata(PAPEIS_CHAVE, metodo('rota'))).toEqual(['ADMIN']);
  });

  it('deixa passar o papel exigido', () => {
    expect(guard.canActivate(contexto('rota', usuario('ADMIN')))).toBe(true);
    expect(guard.canActivate(contexto('rotaDupla', usuario('GESTOR')))).toBe(true);
  });

  it('USUARIO em rota de ADMIN → 403', () => {
    expect(() => guard.canActivate(contexto('rota', usuario('USUARIO')))).toThrow(ForbiddenException);
  });

  it('papel "admin" minúsculo (ou "Admin") não vale: comparação exata do enum', () => {
    expect(() => guard.canActivate(contexto('rota', usuario('admin')))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contexto('rota', usuario('Admin')))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(contexto('rota', usuario('ADMIN ')))).toThrow(ForbiddenException);
  });

  it('sem usuário em req.usuario → 401', () => {
    expect(() => guard.canActivate(contexto('rota'))).toThrow(UnauthorizedException);
  });

  it('rota com o guard mas sem @Papeis nega (falha fechada)', () => {
    const semMetadata = { ...contexto('rota', usuario('ADMIN')), getHandler: () => () => {} } as unknown as ExecutionContext;
    expect(() => guard.canActivate(semMetadata)).toThrow(ForbiddenException);
  });

  it('@Papeis() sem nenhum papel é erro de programação na hora de declarar', () => {
    expect(() => Papeis()).toThrow();
  });
});

describe('exigirPapel', () => {
  it('passa para o papel listado e lança 403 para os outros', () => {
    expect(() => exigirPapel(usuario('ADMIN'), 'ADMIN')).not.toThrow();
    expect(() => exigirPapel(usuario('GESTOR'), 'ADMIN', 'GESTOR')).not.toThrow();
    expect(() => exigirPapel(usuario('USUARIO'), 'ADMIN', 'GESTOR')).toThrow(ForbiddenException);
    expect(() => exigirPapel(usuario('admin'), 'ADMIN')).toThrow(ForbiddenException);
  });

  it('sem usuário → 401', () => {
    expect(() => exigirPapel(undefined, 'ADMIN')).toThrow(UnauthorizedException);
  });
});
