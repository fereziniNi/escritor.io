import { isIPv6 } from 'node:net';
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
    /** Máximo de chaves em memória (varredura de IPs não esgota a memória nem a CPU). */
    private readonly tetoChaves = 10_000,
  ) {}

  /** Conta uma requisição de `chave`. Devolve null dentro do limite; acima dele, os segundos até a janela virar. */
  registrar(chave: string): number | null {
    const t = this.agora();
    const atual = this.#contagens.get(chave);
    if (atual && t - atual.inicio < this.janelaMs) {
      atual.total += 1;
      if (atual.total <= this.limite) return null;
      return Math.max(1, Math.ceil((atual.inicio + this.janelaMs - t) / 1000));
    }
    // Janela nova: a chave vai para o fim do Map, que fica ordenado pelo início da janela (mais antiga na frente).
    this.#contagens.delete(chave);
    this.#abrirEspaco(t);
    this.#contagens.set(chave, { inicio: t, total: 1 });
    return null;
  }

  /**
   * Custo proporcional só ao que sai: descarta da frente as janelas vencidas e, se ainda estiver no teto, as mais
   * antigas (perder a contagem de uma chave antiga só a deixa recomeçar; o mapa nunca passa de tetoChaves).
   */
  #abrirEspaco(t: number): void {
    for (const [k, v] of this.#contagens) {
      const vencida = t - v.inicio >= this.janelaMs;
      if (!vencida && this.#contagens.size < this.tetoChaves) break;
      this.#contagens.delete(k);
    }
  }

  /** Quantas chaves estão em memória (testes). */
  get tamanho(): number {
    return this.#contagens.size;
  }
}

/**
 * Chave de limite de um IP: IPv4 como está (inclusive o mapeado "::ffff:a.b.c.d"); IPv6 pelo prefixo /64, que é o
 * que um único cliente costuma ter inteiro (trocar o endereço dentro dele não escapa do limite).
 */
export function chaveDeIp(ip: string | undefined): string {
  if (!ip) return 'desconhecido';
  const mapeado = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapeado) return mapeado[1]!;
  if (!isIPv6(ip)) return ip;
  const [esquerda = '', direita] = ip.toLowerCase().split('::');
  const partes = (texto: string) => (texto ? texto.split(':').flatMap((g) => (g.includes('.') ? ['0', '0'] : [g])) : []);
  const a = partes(esquerda);
  const b = direita === undefined ? [] : partes(direita);
  const grupos = direita === undefined ? a : [...a, ...Array<string>(8 - a.length - b.length).fill('0'), ...b];
  return `${grupos.slice(0, 4).map((g) => parseInt(g, 16).toString(16)).join(':')}::/64`;
}

/** Responde 429 (formato padrão do FiltroErros) com Retry-After. */
export function recusarPorLimite(res: Response, segundos: number): never {
  res.setHeader('Retry-After', String(segundos));
  throw new HttpException('Muitas requisições; tente de novo em instantes', HttpStatus.TOO_MANY_REQUESTS);
}

/**
 * LIMITE_REQ_POR_IP requisições por minuto por IP em /api/*. O IP é o `req.ip` do Express, que só considera o
 * X-Forwarded-For quando PROXIES_CONFIAVEIS > 0 (senão qualquer cliente trocaria de IP mudando o cabeçalho); IPv6
 * conta por /64 (chaveDeIp).
 */
@Injectable()
export class LimitePorIpMiddleware implements NestMiddleware {
  readonly #limitador: LimitadorJanelaFixa;

  constructor(@Inject(CONFIG) config: Config) {
    this.#limitador = new LimitadorJanelaFixa(config.LIMITE_REQ_POR_IP, UM_MINUTO_MS);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const espera = this.#limitador.registrar(`ip:${chaveDeIp(req.ip)}`);
    if (espera !== null) recusarPorLimite(res, espera);
    next();
  }
}
