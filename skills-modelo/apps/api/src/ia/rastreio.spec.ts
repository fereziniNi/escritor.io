import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { describe, expect, it } from 'vitest';
import { Segredo } from '../config/segredo';
import { criarRastreio } from './rastreio';

const GERACAO = {
  nome: 'resumo',
  modelo: 'claude-sonnet-5-5',
  entrada: 'Cliente 123.456.789-09 (ana@exemplo.com.br) pediu o resumo',
  saida: 'Resumo do cliente 123.456.789-09',
  tokensEntrada: 120,
  tokensSaida: 30,
  custoUsd: 0.00054,
  inicio: 1_000,
  fim: 1_850,
  userId: 'u-1',
  sessionId: 's-1',
};

function comExportador(capturar: boolean) {
  const exportador = new InMemorySpanExporter();
  const rastreio = criarRastreio({ LANGFUSE_CAPTURAR_CONTEUDO: capturar }, { processadoresExtras: [new SimpleSpanProcessor(exportador)] });
  return { exportador, rastreio };
}

describe('criarRastreio', () => {
  it('sem chaves do Langfuse não registra exportador nenhum', async () => {
    const rastreio = criarRastreio({ LANGFUSE_CAPTURAR_CONTEUDO: false });
    expect(rastreio.ativo).toBe(false);
    expect(rastreio.exportadores).toBe(0);
    rastreio.registrar(GERACAO); // no-op, não lança
    await rastreio.encerrar();
  });

  it('chaves incompletas (falta a URL) também não registram exportador', () => {
    const rastreio = criarRastreio({
      LANGFUSE_CAPTURAR_CONTEUDO: false,
      LANGFUSE_PUBLIC_KEY: 'pk-lf-x',
      LANGFUSE_SECRET_KEY: new Segredo('sk-lf-x'),
    });
    expect(rastreio.exportadores).toBe(0);
  });

  it('com as três variáveis registra o exportador do Langfuse', async () => {
    const rastreio = criarRastreio({
      LANGFUSE_CAPTURAR_CONTEUDO: false,
      LANGFUSE_PUBLIC_KEY: 'pk-lf-x',
      LANGFUSE_SECRET_KEY: new Segredo('sk-lf-x'),
      LANGFUSE_URL: 'http://127.0.0.1:3100',
    });
    expect(rastreio.ativo).toBe(true);
    expect(rastreio.exportadores).toBe(1);
    await rastreio.encerrar();
  });

  it('CAPTURAR_CONTEUDO=false: só metadados, o span não tem input nem output', async () => {
    const { exportador, rastreio } = comExportador(false);
    rastreio.registrar(GERACAO);
    const [span] = exportador.getFinishedSpans();
    await rastreio.encerrar();
    expect(span).toBeDefined();
    const a = span!.attributes;
    expect(a['langfuse.observation.input']).toBeUndefined();
    expect(a['langfuse.observation.output']).toBeUndefined();
    expect(JSON.stringify(a)).not.toContain('123.456');
    expect(a['langfuse.observation.model.name']).toBe('claude-sonnet-5-5');
    expect(JSON.parse(a['langfuse.observation.usage_details'] as string)).toEqual({ input: 120, output: 30, total: 150 });
    expect(JSON.parse(a['langfuse.observation.cost_details'] as string)).toEqual({ total: 0.00054 });
    expect(a['user.id']).toBe('u-1');
    expect(a['session.id']).toBe('s-1');
    const ms = (t: [number, number]) => t[0] * 1e3 + t[1] / 1e6;
    expect(ms(span!.endTime) - ms(span!.startTime)).toBeCloseTo(850, 0);
  });

  it('CAPTURAR_CONTEUDO=true: o conteúdo vai mascarado (CPF e e-mail não saem)', async () => {
    const { exportador, rastreio } = comExportador(true);
    rastreio.registrar(GERACAO);
    const a = exportador.getFinishedSpans()[0]!.attributes;
    await rastreio.encerrar();
    const entrada = a['langfuse.observation.input'] as string;
    const saida = a['langfuse.observation.output'] as string;
    expect(entrada).toContain('***.456.789-**');
    expect(entrada).not.toContain('123.456.789-09');
    expect(entrada).not.toContain('ana@exemplo.com.br');
    expect(saida).not.toContain('123.456.789-09');
  });

  it('custo desconhecido (null): o span sai sem cost_details', async () => {
    const { exportador, rastreio } = comExportador(false);
    rastreio.registrar({ ...GERACAO, custoUsd: null });
    expect(exportador.getFinishedSpans()[0]!.attributes['langfuse.observation.cost_details']).toBeUndefined();
    await rastreio.encerrar();
  });

  it('erro da chamada: marca o span com o tipo do erro, nunca a mensagem', async () => {
    const { exportador, rastreio } = comExportador(false);
    rastreio.registrar({ ...GERACAO, saida: undefined, erro: 'RateLimitError' });
    const a = exportador.getFinishedSpans()[0]!.attributes;
    await rastreio.encerrar();
    expect(a['langfuse.observation.level']).toBe('ERROR');
    expect(a['langfuse.observation.status_message']).toBe('RateLimitError');
  });
});
