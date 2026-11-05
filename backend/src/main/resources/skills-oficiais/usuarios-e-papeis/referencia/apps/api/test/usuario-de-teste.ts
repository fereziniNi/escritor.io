// origem: skills-modelo/apps/api/test/usuario-de-teste.ts
import { type INestApplication } from '@nestjs/common';
import { type NextFunction, type Request, type Response } from 'express';
import { type UsuarioAtual } from '../src/usuarios/usuario-atual';

/**
 * Faz o papel da skill de login nos testes: lê o cabeçalho `x-usuario-teste` (JSON de um `UsuarioAtual`) e o põe em
 * `req.usuario`, exatamente o que o login de verdade fará depois de validar a sessão. Chame ANTES de `app.init()`.
 * Este arquivo vive em test/: nunca vai para o build da API.
 */
export function exporUsuarioDeTeste(app: INestApplication): void {
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const cabecalho = req.get('x-usuario-teste');
    if (cabecalho !== undefined) req.usuario = JSON.parse(cabecalho) as UsuarioAtual;
    next();
  });
}

/** Valor do cabeçalho `x-usuario-teste` para um usuário (papel passado como veio, para testar o "admin" minúsculo). */
export const comoUsuario = (u: { id: string; email: string; nome: string; papel: string }): string => JSON.stringify(u);
