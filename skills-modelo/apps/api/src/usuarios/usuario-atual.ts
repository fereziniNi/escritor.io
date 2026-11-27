import { createParamDecorator, type ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { type Request } from 'express';
import { type Papel } from './papel';

/**
 * CONTRATO COM A SKILL DE LOGIN: quem está autenticado nesta requisição.
 * A skill `login-codigo-email` (ou qualquer outro login) preenche `req.usuario` num middleware, a cada requisição, lendo
 * a sessão E o usuário no banco (a linha tem de existir e estar `ativo = true`; desativado perde o acesso na hora).
 * Sem sessão válida, `req.usuario` fica `undefined` e o `PapeisGuard` responde 401. Nada em src/usuarios/ conhece
 * cookie, sessão ou código: só lê `req.usuario`. Nos testes, `test/usuario-de-teste.ts` faz o papel do login.
 */
export interface UsuarioAtual {
  id: string;
  email: string;
  nome: string;
  papel: Papel;
}

declare module 'express' {
  interface Request {
    usuario?: UsuarioAtual;
  }
}

/** Parâmetro de rota: `listar(@UsuarioLogado() eu: UsuarioAtual)`. Sem usuário na requisição → 401. */
export const UsuarioLogado = createParamDecorator((_dado: unknown, contexto: ExecutionContext): UsuarioAtual => {
  const usuario = contexto.switchToHttp().getRequest<Request>().usuario;
  if (!usuario) throw new UnauthorizedException();
  return usuario;
});

/**
 * Checagem de papel DENTRO do serviço. O `@Papeis` na rota é a primeira barreira; esta é a segunda, para quando o
 * serviço é chamado por outra rota, por uma tarefa agendada ou por outro serviço (lição SEC-001/VULN-02: o decorator
 * sozinho não protege o dado). Comparação exata: `"admin"` não é `ADMIN`.
 */
export function exigirPapel(usuario: UsuarioAtual | undefined, ...papeis: Papel[]): asserts usuario is UsuarioAtual {
  if (!usuario) throw new UnauthorizedException();
  if (!papeis.includes(usuario.papel)) throw new ForbiddenException();
}
