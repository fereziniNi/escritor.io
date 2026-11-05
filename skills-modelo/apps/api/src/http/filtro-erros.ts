import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { type Request, type Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

/** Corpo padrão de erro da API: nunca stack, SQL ou mensagem interna; o requestId liga a resposta ao log. */
export interface CorpoErro {
  status: number;
  erro: string;
  requestId?: string;
}

const MENSAGENS: Record<number, string> = {
  400: 'Requisição inválida',
  401: 'Não autenticado',
  403: 'Acesso negado',
  404: 'Não encontrado',
  409: 'Conflito',
  413: 'Conteúdo grande demais',
  429: 'Muitas requisições; tente de novo em instantes',
};

/** Registrado como APP_FILTER no AppModule (precisa de injeção para o logger com request-id). */
@Catch()
export class FiltroErros implements ExceptionFilter {
  constructor(@InjectPinoLogger(FiltroErros.name) private readonly log: PinoLogger) {}

  catch(excecao: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { id?: string }>();
    const res = http.getResponse<Response>();
    const status = excecao instanceof HttpException ? excecao.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (status >= 500) {
      // Detalhe só no log (com o request-id); o cliente recebe a mensagem genérica.
      this.log.error({ err: excecao }, 'erro não tratado');
    }
    const corpo: CorpoErro = {
      status,
      erro: status >= 500 ? 'Erro interno' : mensagemDoCliente(excecao, status),
      ...(req.id ? { requestId: String(req.id) } : {}),
    };
    res.status(status).json(corpo);
  }
}

/** Erros 4xx lançados pelo próprio código (ex.: new BadRequestException('CPF inválido')) mantêm a mensagem. */
function mensagemDoCliente(excecao: unknown, status: number): string {
  if (excecao instanceof HttpException && status !== 404) {
    const r = excecao.getResponse();
    const msg = typeof r === 'string' ? r : (r as { message?: unknown }).message;
    if (typeof msg === 'string') return msg;
  }
  return MENSAGENS[status] ?? 'Erro na requisição';
}
