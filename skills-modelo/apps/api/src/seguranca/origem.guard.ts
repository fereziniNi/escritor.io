import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  type NestMiddleware,
  UseGuards,
} from '@nestjs/common';
import { type NextFunction, type Request, type Response } from 'express';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';

// Proteção contra requisição forjada entre sites (CSRF), em duas partes:
// 1. VerificarOrigemMiddleware (toda a /api): POST, PUT, PATCH e DELETE só com Origin (ou, sem ele, Referer) da
//    própria origem ou de CORS_ORIGENS. Navegador sempre manda Origin nesses métodos; sem Origin, Referer nem
//    Sec-Fetch-Site é cliente que não é navegador (integração, curl), que não carrega cookie de vítima: passa.
// 2. @MesmaOrigem() em GET com efeito colateral (baixar arquivo que registra algo, confirmar por link): recusa
//    navegação vinda de outro site pelo Sec-Fetch-Site, que o cookie SameSite=Lax ainda deixaria passar.
// "Própria origem" = req.protocol + Host; atrás do Caddy, PROXIES_CONFIAVEIS=1 faz o Express ler o https real.

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);
const MENSAGEM = 'Origem da requisição não permitida';

/** Origem (esquema + host + porta) de uma URL; null para ausente, "null" ou inválida. */
function origemDe(valor: string | undefined): string | null {
  if (!valor || valor === 'null') return null;
  try {
    const origem = new URL(valor).origin;
    return origem === 'null' ? null : origem;
  } catch {
    return null;
  }
}

const propriaOrigem = (req: Request) => `${req.protocol}://${req.get('host') ?? ''}`;

/** Sec-Fetch-Site de navegador vindo de outro site ("same-site" inclui subdomínio irmão, também recusado). */
const outroSite = (req: Request) => {
  const site = req.get('sec-fetch-site');
  return site === 'cross-site' || site === 'same-site';
};

/** true quando a requisição altera estado e veio de uma origem que não é a do sistema nem de CORS_ORIGENS. */
export function origemRecusada(req: Request, permitidas: readonly string[]): boolean {
  if (METODOS_SEGUROS.has(req.method)) return false;
  const origin = req.get('origin');
  const referer = req.get('referer');
  if (origin === undefined && referer === undefined) return outroSite(req);
  // Origin presente decide sozinho (inclusive "null", que é recusado); Referer só vale quando não há Origin.
  const origem = origin !== undefined ? origemDe(origin) : origemDe(referer);
  return !(origem && (origem === propriaOrigem(req) || permitidas.includes(origem)));
}

/**
 * GET com efeito colateral: "same-origin" (o próprio front) e "none" (endereço digitado) passam; "same-site" e
 * "cross-site" só com Origin de CORS_ORIGENS. Sem Sec-Fetch-Site (cliente que não é navegador) passa.
 */
export function getDeOutroSite(req: Request, permitidas: readonly string[]): boolean {
  if (!outroSite(req)) return false;
  const origem = origemDe(req.get('origin'));
  return !(origem && permitidas.includes(origem));
}

/** Aplicado a toda a /api pelo SegurancaModule. */
@Injectable()
export class VerificarOrigemMiddleware implements NestMiddleware {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    if (origemRecusada(req, this.config.CORS_ORIGENS)) throw new ForbiddenException(MENSAGEM);
    next();
  }
}

@Injectable()
export class MesmaOrigemGuard implements CanActivate {
  constructor(@Inject(CONFIG) private readonly config: Config) {}

  canActivate(contexto: ExecutionContext): boolean {
    if (getDeOutroSite(contexto.switchToHttp().getRequest<Request>(), this.config.CORS_ORIGENS)) {
      throw new ForbiddenException(MENSAGEM);
    }
    return true;
  }
}

/** Use em GET que muda algo: `@Get('exportar') @MesmaOrigem() exportar() {...}`. */
export const MesmaOrigem = () => UseGuards(MesmaOrigemGuard);
