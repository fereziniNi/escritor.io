// origem: skills-modelo/apps/api/src/seguranca/limitador.ts
import { HttpException, HttpStatus, Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import { type NextFunction, type Request, type Response } from 'express';
import { type Config } from '../config/config';
import { CONFIG } from '../config/config.module';

const UM_MINUTO_MS = 60_000;

/**
 * Limite de requisições em janela fixa, por chave, em memória da instância (com N réplicas o limite efetivo é até N
 * vezes o configurado). Serve de freio contra abuso e erro de cliente. Use uma instância por regra:
 * `new LimitadorJanelaFixa(5, 15 * 60_000)` com chave `email:${email}` para tentativas de login, por exemplo.
 * Limite de negócio que precisa valer entre réplicas (códigos por e-mail) fica no banco.
 */
export class LimitadorJanelaFixa {
  readonly #contagens = new Map<string, { inicio: number; total: number }>();

  constructor(
    private readonly limite: number,
    private readonly janelaMs: number,
    private readonly agora: () => number = Date.now,
    /** Acima de tantas chaves, as janelas vencidas são descartadas (memória limitada sob varredura de IPs). */
    private readonly tetoChaves = 10_000,
  ) {}

  /** Conta uma requisição de `chave`. Devolve null dentro do limite; acima dele, os segundos até a janela virar. */
  registrar(chave: string): number | null {
    const t = this.agora();
    if (this.#contagens.size >= this.tetoChaves) {
      for (const [k, v] of this.#contagens) if (t - v.inicio >= this.janelaMs) this.#contagens.delete(k);
    }
    const atual = this.#contagens.get(chave);
    if (!atual || t - atual.inicio >= this.janelaMs) {
      this.#contagens.set(chave, { inicio: t, total: 1 });
      return null;
    }
    atual.total += 1;
    if (atual.total <= this.limite) return null;
    return Math.max(1, Math.ceil((atual.inicio + this.janelaMs - t) / 1000));
  }

  /** Quantas chaves estão em memória (testes). */
  get tamanho(): number {
    return this.#contagens.size;
  }
}

/** Responde 429 (formato padrão do FiltroErros) com Retry-After. */
export function recusarPorLimite(res: Response, segundos: number): never {
  res.setHeader('Retry-After', String(segundos));
  throw new HttpException('Muitas requisições; tente de novo em instantes', HttpStatus.TOO_MANY_REQUESTS);
}

/**
 * LIMITE_REQ_POR_IP requisições por minuto por IP em /api/*. O IP é o `req.ip` do Express, que só considera o
 * X-Forwarded-For quando PROXIES_CONFIAVEIS > 0 (senão qualquer cliente trocaria de IP mudando o cabeçalho).
 */
@Injectable()
export class LimitePorIpMiddleware implements NestMiddleware {
  readonly #limitador: LimitadorJanelaFixa;

  constructor(@Inject(CONFIG) config: Config) {
    this.#limitador = new LimitadorJanelaFixa(config.LIMITE_REQ_POR_IP, UM_MINUTO_MS);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const espera = this.#limitador.registrar(`ip:${req.ip ?? 'desconhecido'}`);
    if (espera !== null) recusarPorLimite(res, espera);
    next();
  }
}
