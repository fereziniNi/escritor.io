import { type ArgumentsHost, NotFoundException } from '@nestjs/common';
import { type PinoLogger } from 'nestjs-pino';
import { describe, expect, it, vi } from 'vitest';
import { FiltroErros } from './filtro-erros';

function contexto(headersSent: boolean) {
  const res = {
    headersSent,
    writableEnded: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    end: vi.fn(),
  };
  const host = { switchToHttp: () => ({ getRequest: () => ({ id: 'req-1' }), getResponse: () => res }) } as unknown as ArgumentsHost;
  const logErro = vi.fn();
  const log = { error: logErro } as unknown as PinoLogger;
  return { res, host, log, logErro };
}

describe('FiltroErros', () => {
  it('responde o JSON padrão com status, erro e requestId', () => {
    const { res, host, log } = contexto(false);
    new FiltroErros(log).catch(new NotFoundException(), host);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ status: 404, erro: 'Não encontrado', requestId: 'req-1' });
  });

  it('erro depois de a resposta começar (headers já enviados): só registra e encerra, sem escrever corpo', () => {
    const { res, host, log, logErro } = contexto(true);
    new FiltroErros(log).catch(new Error('falhou no meio do streaming'), host);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(res.end).toHaveBeenCalled();
    expect(logErro).toHaveBeenCalled();
  });
});
