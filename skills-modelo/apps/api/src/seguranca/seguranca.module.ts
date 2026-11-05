import { type INestApplication, type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { type Config } from '../config/config';
import { cabecalhosSeguranca } from './cabecalhos.middleware';
import { configurarCors } from './cors';
import { LimitePorIpMiddleware } from './limitador';
import { VerificarOrigemMiddleware } from './origem.guard';

/**
 * Limite por IP e checagem de origem (CSRF) em toda a /api. Importado no AppModule DEPOIS do LogModule: assim a
 * requisição recusada (429/403) já tem request-id, aparece no log e sai no formato padrão do FiltroErros.
 */
@Module({})
export class SegurancaModule implements NestModule {
  configure(consumidor: MiddlewareConsumer): void {
    consumidor.apply(LimitePorIpMiddleware, VerificarOrigemMiddleware).forRoutes({ path: '{/*caminho}', method: RequestMethod.ALL });
  }
}

/**
 * Parte da segurança que vale para o servidor HTTP inteiro (chamada no configurarApp, antes do SPA e das rotas):
 * sem X-Powered-By, proxies confiáveis (IP real, https e host vindos do Caddy), cabeçalhos e CORS.
 */
export function aplicarSeguranca(app: INestApplication, config: Config): void {
  const express = app as NestExpressApplication;
  express.disable('x-powered-by');
  express.set('trust proxy', config.PROXIES_CONFIAVEIS);
  express.use(cabecalhosSeguranca);
  configurarCors(app, config);
}
