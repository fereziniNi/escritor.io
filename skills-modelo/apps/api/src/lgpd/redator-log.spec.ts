import pino from 'pino';
import { describe, expect, it } from 'vitest';
import { CAMPOS_PESSOAIS_LOG, destinoSemDadosPessoais, redigirLinhaLog } from './redator-log';

/** Logger pino como o da API: `redact` com os campos pessoais + destino que varre CPF. Devolve as linhas escritas. */
function loggerDeTeste() {
  const linhas: string[] = [];
  const logger = pino(
    { redact: { paths: [...CAMPOS_PESSOAIS_LOG], censor: '[REDACTED]' } },
    destinoSemDadosPessoais({ write: (l: string) => void linhas.push(l) }),
  );
  return { logger, linhas };
}

describe('redigirLinhaLog', () => {
  it('mascara CPF dentro de strings do JSON e mantém o JSON válido', () => {
    const linha = `${JSON.stringify({ level: 30, time: 1793915038030, msg: 'cliente 123.456.789-09 / 12345678909' })}\n`;
    const saida = redigirLinhaLog(linha);
    expect(saida.endsWith('\n')).toBe(true);
    expect(JSON.parse(saida)).toEqual({ level: 30, time: 1793915038030, msg: 'cliente ***.456.789-** / ***.456.789-**' });
  });

  it('CPF como número (11 dígitos válidos) vira texto mascarado', () => {
    const saida = redigirLinhaLog(`${JSON.stringify({ msg: 'x', valor: 12345678909 })}\n`);
    expect(JSON.parse(saida)).toEqual({ msg: 'x', valor: '***.456.789-**' });
  });

  it('linha sem CPF passa idêntica (sem custo de parse)', () => {
    const linha = `${JSON.stringify({ level: 30, time: 1793915038030, msg: 'ok', pedido: 12345678900 })}\n`;
    expect(redigirLinhaLog(linha)).toBe(linha);
  });

  it('texto que não é JSON também é varrido', () => {
    expect(redigirLinhaLog('falhou 123.456.789-09\n')).toBe('falhou ***.456.789-**\n');
  });
});

describe('destinoSemDadosPessoais', () => {
  it('repassa flushSync e end do destino original (últimas linhas não se perdem) e não inventa os que ele não tem', () => {
    const chamados: string[] = [];
    const embrulho = destinoSemDadosPessoais({ write: () => undefined, flushSync: () => void chamados.push('flush'), end: () => void chamados.push('end') });
    embrulho.flushSync?.();
    embrulho.end?.();
    expect(chamados).toEqual(['flush', 'end']);
    const simples = destinoSemDadosPessoais({ write: () => undefined });
    expect(simples.flushSync).toBeUndefined();
    expect(simples.end).toBeUndefined();
  });
});

describe('log com CPF sai mascarado (pino com redact + varredura)', () => {
  it('campos pessoais (cpf, email, telefone...) saem [REDACTED], no topo e um nível abaixo', () => {
    const { logger, linhas } = loggerDeTeste();
    logger.info({ cpf: '12345678909', email: 'ana.souza@exemplo.com.br', cliente: { cpf: '529.982.247-25', telefone: '11987654321' } }, 'criado');
    const registro = JSON.parse(linhas[0]!) as Record<string, unknown>;
    expect(registro['cpf']).toBe('[REDACTED]');
    expect(registro['email']).toBe('[REDACTED]');
    expect(registro['cliente']).toEqual({ cpf: '[REDACTED]', telefone: '[REDACTED]' });
  });

  it('CPF no meio da mensagem, num campo qualquer ou no erro sai mascarado', () => {
    const { logger, linhas } = loggerDeTeste();
    logger.info('cliente 123.456.789-09 criado');
    logger.warn({ detalhe: { texto: 'cpf 12345678909 duplicado' } }, 'conflito');
    logger.error({ err: new Error('falhou para 529.982.247-25') }, 'erro');
    const tudo = linhas.join('');
    expect(tudo).not.toContain('123.456.789-09');
    expect(tudo).not.toContain('12345678909');
    expect(tudo).not.toContain('529.982.247-25');
    expect(tudo).toContain('***.456.789-**');
    expect(tudo).toContain('***.982.247-**');
    for (const l of linhas) expect(() => JSON.parse(l) as unknown).not.toThrow();
  });
});
