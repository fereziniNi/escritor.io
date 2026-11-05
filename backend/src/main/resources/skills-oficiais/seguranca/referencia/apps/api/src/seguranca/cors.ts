// origem: skills-modelo/apps/api/src/seguranca/cors.ts
import { type INestApplication } from '@nestjs/common';
import { type Config } from '../config/config';

/** Comparação exata com a lista (o navegador manda a origem já normalizada). Nunca lança. */
export function origemCorsPermitida(origem: string | undefined, permitidas: readonly string[]): boolean {
  return origem !== undefined && permitidas.includes(origem);
}

/**
 * CORS só para as origens de CORS_ORIGENS; sem a variável, desligado (o front é servido no mesmo endereço da API).
 * Origem fora da lista recebe a resposta sem Access-Control-Allow-Origin (o navegador bloqueia a leitura): a função
 * de origem nunca devolve erro, porque erro aqui vira 500 em vez de recusa limpa.
 */
export function configurarCors(app: INestApplication, config: Config): void {
  if (config.CORS_ORIGENS.length === 0) return;
  app.enableCors({
    origin: (origem: string | undefined, responder: (erro: Error | null, permitir?: boolean) => void) => {
      responder(null, origemCorsPermitida(origem, config.CORS_ORIGENS));
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-Request-Id'],
    exposedHeaders: ['Content-Disposition', 'Retry-After', 'X-Request-Id'],
    maxAge: 600,
  });
}
