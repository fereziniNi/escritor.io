// origem: skills-modelo/apps/api/src/auth/sessao.guard.ts
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  type NestMiddleware,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { type NextFunction, type Request, type Response } from 'express';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';
import { AuthService } from './auth.service';
import { cookieSessao, lerCookie } from './cookie-sessao';

/**
 * Em TODA requisição a /api: lê o cookie de sessão, valida a sessão e o usuário no banco e preenche `req.usuario`
 * (contrato da skill usuarios-e-papeis). Sem cookie ou com sessão inválida, `req.usuario` fica como está (undefined
 * fora dos testes) e quem exige login (`@Papeis`, `SessaoGuard`) responde 401.
 */
@Injectable()
export class SessaoMiddleware implements NestMiddleware {
  private readonly nomeCookie: string;

  constructor(
    private readonly auth: AuthService,
    @Inject(CONFIG) config: Config,
  ) {
    this.nomeCookie = cookieSessao(config).nome;
  }

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    const token = lerCookie(req.get('cookie'), this.nomeCookie);
    if (token !== undefined) {
      const usuario = await this.auth.usuarioDaSessao(token);
      if (usuario) req.usuario = usuario;
    }
    next();
  }
}

/** Exige só estar logado (qualquer papel): sem `req.usuario` → 401. Para exigir papel use `@Papeis(...)`. */
@Injectable()
export class SessaoGuard implements CanActivate {
  canActivate(contexto: ExecutionContext): boolean {
    if (!contexto.switchToHttp().getRequest<Request>().usuario) throw new UnauthorizedException();
    return true;
  }
}

/** `@ExigirSessao()` na rota ou no controller. */
export const ExigirSessao = () => UseGuards(SessaoGuard);
