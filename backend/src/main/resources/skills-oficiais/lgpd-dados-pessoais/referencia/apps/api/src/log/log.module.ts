// origem: skills-modelo/apps/api/src/log/log.module.ts
import { randomUUID } from 'node:crypto';
import { type IncomingMessage, type ServerResponse } from 'node:http';
import { type DynamicModule, Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import pino, { type DestinationStream } from 'pino';
import { type Options } from 'pino-http';
import { type Config } from '../config/config';
import { CAMPOS_PESSOAIS_LOG, destinoSemDadosPessoais } from '../lgpd/redator-log';

export const CABECALHO_REQUEST_ID = 'x-request-id';
/** Request-id recebido só é aceito neste formato; qualquer outra coisa é trocada por um UUID novo. */
const FORMATO_REQUEST_ID = /^[A-Za-z0-9._-]{8,128}$/;

/**
 * Defesa em profundidade: se algum log receber um objeto inesperado, estes campos saem censurados. A regra principal
 * continua sendo não passar corpo de requisição, credencial nem dado pessoal ao logger. Os campos de dado pessoal
 * (cpf, email, telefone...) vêm da skill lgpd-dados-pessoais (lgpd/redator-log.ts).
 */
const CAMPOS_CENSURADOS = [
  'req.headers',
  'req.query',
  'req.body',
  'res.headers',
  '*.authorization',
  '*.cookie',
  '*.senha',
  '*.password',
  '*.token',
  '*.segredo',
  ...CAMPOS_PESSOAIS_LOG,
];

/** Usa o X-Request-Id recebido (do Caddy ou do cliente) se for válido; senão gera um. Sempre devolve no header. */
export function requestIdDe(req: IncomingMessage, res: ServerResponse): string {
  const recebido = req.headers[CABECALHO_REQUEST_ID];
  const id = typeof recebido === 'string' && FORMATO_REQUEST_ID.test(recebido) ? recebido : randomUUID();
  res.setHeader(CABECALHO_REQUEST_ID, id);
  return id;
}

/** Caminho sem query string: parâmetros de busca podem carregar CPF, e-mail ou nomes. */
const semQuery = (url: string | undefined) => url?.split('?', 1)[0];

function opcoesPinoHttp(config: Config): Options {
  return {
    level: config.LOG_LEVEL,
    genReqId: requestIdDe,
    redact: { paths: CAMPOS_CENSURADOS, censor: '[REDACTED]' },
    // Só metadados da requisição: nunca headers, query ou corpo.
    serializers: {
      req: (req: { id: unknown; method: string; url?: string }) => ({ id: req.id, method: req.method, path: semQuery(req.url) }),
      res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
    },
  };
}

@Module({})
export class LogModule {
  /**
   * `destino` permite capturar os logs nos testes; por padrão, JSON em stdout (uma linha por evento). Todo destino passa
   * pela varredura de CPF (lgpd/redator-log.ts): CPF que escapar do `redact` sai mascarado.
   */
  static registrar(config: Config, destino?: DestinationStream): DynamicModule {
    const opcoes = opcoesPinoHttp(config);
    return {
      module: LogModule,
      imports: [LoggerModule.forRoot({ pinoHttp: [opcoes, destinoSemDadosPessoais(destino ?? pino.destination(1))] })],
    };
  }
}
