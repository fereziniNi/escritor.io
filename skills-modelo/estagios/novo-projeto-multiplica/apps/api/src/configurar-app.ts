import { existsSync } from 'node:fs';
import path from 'node:path';
import { type INestApplication } from '@nestjs/common';
import express, { type NextFunction, type Request, type Response } from 'express';
import { Logger } from 'nestjs-pino';
import { type Config } from './config/config';

export const PREFIXO_API = 'api';

const ehApi = (caminho: string) => caminho === `/${PREFIXO_API}` || caminho.startsWith(`/${PREFIXO_API}/`);

/**
 * Serve o build da web (uma imagem só: a API entrega o SPA). Regras:
 * - /api/* nunca cai no SPA: rota desconhecida segue para o 404 JSON do Nest;
 * - arquivo inexistente (/assets/x.js, *.png) responde 404, nunca o index.html (o navegador percebe a versão nova);
 * - index.html sem cache; /assets/* (nome com hash) cache de 1 ano.
 */
function servirSpa(app: INestApplication, pasta: string): void {
  const indice = path.join(pasta, 'index.html');
  if (!existsSync(indice)) throw new Error(`WEB_DIST: ${pasta} não tem index.html (rode o build da web)`);
  const estaticos = express.static(pasta, {
    index: false,
    setHeaders: (res, arquivo) => {
      res.setHeader('cache-control', /[/\\]assets[/\\]/.test(arquivo) ? 'public, max-age=31536000, immutable' : 'no-cache');
    },
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (ehApi(req.path)) next();
    else void estaticos(req, res, next);
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const ehPagina = (req.method === 'GET' || req.method === 'HEAD') && !ehApi(req.path) && !/\.[A-Za-z0-9]+$/.test(req.path);
    if (!ehPagina) return next();
    res.setHeader('cache-control', 'no-cache');
    res.sendFile(indice);
  });
}

/** Configuração comum à aplicação real (main.ts) e aos testes e2e. */
export function configurarApp(app: INestApplication, config: Config): INestApplication {
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix(PREFIXO_API);
  if (config.WEB_DIST) servirSpa(app, path.resolve(config.WEB_DIST));
  app.enableShutdownHooks();
  return app;
}
