// origem: skills-modelo/apps/api/src/usuarios/papeis.guard.ts
import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable, SetMetadata, UnauthorizedException, UseGuards, applyDecorators } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Request } from 'express';
import { type Papel } from './papel';

export const PAPEIS_CHAVE = 'papeis';

/** Guard por papel. Compara por igualdade exata com os papéis do `@Papeis`; sem `@Papeis` na rota, nega (falha fechada). */
@Injectable()
export class PapeisGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const usuario = contexto.switchToHttp().getRequest<Request>().usuario;
    if (!usuario) throw new UnauthorizedException();
    const exigidos = this.reflector.getAllAndOverride<Papel[] | undefined>(PAPEIS_CHAVE, [contexto.getHandler(), contexto.getClass()]);
    if (!exigidos || !exigidos.includes(usuario.papel)) throw new ForbiddenException();
    return true;
  }
}

/**
 * `@Papeis('ADMIN')` na rota ou no controller: exige usuário autenticado (401) com um dos papéis (403). Já liga o
 * `PapeisGuard`, não precisa de `@UseGuards`. Rota sem `@Papeis` fica aberta a quem o login deixar passar:
 * em controller novo, decida o papel de TODA rota.
 */
export function Papeis(...papeis: Papel[]): MethodDecorator & ClassDecorator {
  if (papeis.length === 0) throw new Error('@Papeis() exige ao menos um papel');
  return applyDecorators(SetMetadata(PAPEIS_CHAVE, papeis), UseGuards(PapeisGuard));
}
