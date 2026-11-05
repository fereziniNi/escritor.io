// origem: skills-modelo/apps/api/src/auditoria/contexto-requisicao.ts
import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, type NestMiddleware } from '@nestjs/common';
import { type NextFunction, type Request, type Response } from 'express';

/** O que a trilha precisa saber da requisição em andamento, sem que cada serviço passe `req` adiante. */
interface Contexto {
  ip: string | undefined;
  res: Response;
}

const armazenamento = new AsyncLocalStorage<Contexto>();

/** IP e request-id da requisição atual (vazios fora de uma requisição: tarefa agendada, script). */
export function contextoDaRequisicao(): { ip?: string; requestId?: string } {
  const c = armazenamento.getStore();
  if (!c) return {};
  // Lido na hora de registrar: o X-Request-Id é posto na resposta pelo log (pino-http), em qualquer ordem de middlewares.
  const id = c.res.getHeader('x-request-id');
  return { ...(c.ip === undefined ? {} : { ip: c.ip }), ...(typeof id === 'string' ? { requestId: id } : {}) };
}

/** Em toda a /api: guarda o IP (já considerando PROXIES_CONFIAVEIS) e a resposta (de onde sai o request-id) no contexto assíncrono. */
@Injectable()
export class ContextoRequisicaoMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    armazenamento.run({ ip: req.ip, res }, () => next());
  }
}
