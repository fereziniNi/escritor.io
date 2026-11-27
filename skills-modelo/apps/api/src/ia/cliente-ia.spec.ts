import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Segredo } from '../config/segredo';
import { ErroIaDesabilitada, ErroIaResposta, criarClienteIa, exigirConfigIa } from './cliente-ia';
import { criarRastreio } from './rastreio';

interface Chamada {
  caminho: string;
  autorizacao: string | undefined;
  corpo: { model: string; messages: { role: string; content: string }[]; system?: string };
}

let servidor: Server;
let url: string;
let chamadas: Chamada[];
let status = 200;
let motivoParada = 'end_turn';

beforeEach(async () => {
  chamadas = [];
  status = 200;
  motivoParada = 'end_turn';
  servidor = createServer((req: IncomingMessage, res: ServerResponse) => {
    const partes: Buffer[] = [];
    req.on('data', (p: Buffer) => partes.push(p));
    req.on('end', () => {
      chamadas.push({
        caminho: req.url ?? '',
        autorizacao: req.headers['authorization'],
        corpo: JSON.parse(Buffer.concat(partes).toString('utf8')) as Chamada['corpo'],
      });
      res.setHeader('content-type', 'application/json');
      res.statusCode = status;
      if (status !== 200) {
        res.end(JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'segredo-do-erro 123.456.789-09' } }));
        return;
      }
      res.end(
        JSON.stringify({
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: chamadas.at(-1)!.corpo.model,
          content: [
            { type: 'thinking', thinking: '', signature: 'x' },
            { type: 'text', text: 'Resumo pronto.' },
          ],
          stop_reason: motivoParada,
          stop_sequence: null,
          usage: { input_tokens: 1000, output_tokens: 200 },
        }),
      );
    });
  });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  url = `http://127.0.0.1:${(servidor.address() as { port: number }).port}`;
});

afterEach(async () => {
  await new Promise((ok) => servidor.close(ok));
});

const base = { IA_HABILITADA: true, ANTHROPIC_API_KEY: new Segredo('chave-de-teste'), LITELLM_URL: undefined as string | undefined };

describe('criarClienteIa', () => {
  it('IA_HABILITADA=false: a chamada falha com "IA desabilitada neste ambiente" e nada sai pela rede', async () => {
    const ia = criarClienteIa({ ...base, IA_HABILITADA: false, LITELLM_URL: url });
    await expect(ia.gerar({ tarefa: 'resumo', prompt: 'oi' })).rejects.toThrow(ErroIaDesabilitada);
    await expect(ia.gerar({ tarefa: 'resumo', prompt: 'oi' })).rejects.toThrow('IA desabilitada neste ambiente');
    expect(chamadas).toHaveLength(0);
  });

  it('com LITELLM_URL o cliente usa essa base (POST /v1/messages) e manda a chave (o SDK 1.x envia Authorization: Bearer)', async () => {
    const ia = criarClienteIa({ ...base, LITELLM_URL: url }, { env: {} });
    const r = await ia.gerar({ tarefa: 'resumo', prompt: 'Resuma isto', system: 'Seja breve' });
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0]!.caminho).toBe('/v1/messages');
    expect(chamadas[0]!.autorizacao).toBe('Bearer chave-de-teste');
    expect(chamadas[0]!.corpo.model).toBe('claude-sonnet-5-5');
    expect(chamadas[0]!.corpo.messages).toEqual([{ role: 'user', content: 'Resuma isto' }]);
    expect(r).toMatchObject({ texto: 'Resumo pronto.', modelo: 'claude-sonnet-5-5', tokensEntrada: 1000, tokensSaida: 200 });
    expect(r.custoUsd).toBeCloseTo(0.004, 10);
  });

  it('o modelo vem de modeloPara(tarefa)', async () => {
    const ia = criarClienteIa({ ...base, LITELLM_URL: url }, { env: { LLM_MODELO_RESUMO: 'claude-haiku-5-5' } });
    await ia.gerar({ tarefa: 'resumo', prompt: 'x' });
    expect(chamadas[0]!.corpo.model).toBe('claude-haiku-5-5');
  });

  it('registra a geração no rastreio sem conteúdo quando CAPTURAR_CONTEUDO=false', async () => {
    const exportador = new InMemorySpanExporter();
    const rastreio = criarRastreio({ LANGFUSE_CAPTURAR_CONTEUDO: false }, { processadoresExtras: [new SimpleSpanProcessor(exportador)] });
    const ia = criarClienteIa({ ...base, LITELLM_URL: url }, { rastreio, env: {} });
    await ia.gerar({ tarefa: 'resumo', prompt: 'segredo do prompt', userId: 'u-9', sessionId: 's-9' });
    const a = exportador.getFinishedSpans()[0]!.attributes;
    expect(a['user.id']).toBe('u-9');
    expect(a['session.id']).toBe('s-9');
    expect(JSON.stringify(a)).not.toContain('segredo do prompt');
  });

  it('erro da API: lança e o rastreio guarda só o tipo do erro, não a mensagem', async () => {
    status = 400;
    const exportador = new InMemorySpanExporter();
    const rastreio = criarRastreio({ LANGFUSE_CAPTURAR_CONTEUDO: false }, { processadoresExtras: [new SimpleSpanProcessor(exportador)] });
    const ia = criarClienteIa({ ...base, LITELLM_URL: url }, { rastreio, env: {} });
    await expect(ia.gerar({ tarefa: 'resumo', prompt: 'x' })).rejects.toThrow();
    const a = exportador.getFinishedSpans()[0]!.attributes;
    expect(a['langfuse.observation.level']).toBe('ERROR');
    expect(JSON.stringify(a)).not.toContain('123.456.789-09');
  });

  it.each(['max_tokens', 'refusal'] as const)('stop_reason=%s: lança ErroIaResposta (não é sucesso) e o rastreio guarda só o tipo', async (motivo) => {
    motivoParada = motivo;
    const exportador = new InMemorySpanExporter();
    const rastreio = criarRastreio({ LANGFUSE_CAPTURAR_CONTEUDO: false }, { processadoresExtras: [new SimpleSpanProcessor(exportador)] });
    const ia = criarClienteIa({ ...base, LITELLM_URL: url }, { rastreio, env: {} });
    const erro = await ia.gerar({ tarefa: 'resumo', prompt: 'x' }).catch((e: unknown) => e);
    expect(erro).toBeInstanceOf(ErroIaResposta);
    expect((erro as ErroIaResposta).motivo).toBe(motivo);
    const a = exportador.getFinishedSpans()[0]!.attributes;
    expect(a['langfuse.observation.level']).toBe('ERROR');
    expect(a['langfuse.observation.status_message']).toBe('ErroIaResposta');
    expect(JSON.stringify(a)).not.toContain('Resumo pronto.');
  });

  it('habilitada sem ANTHROPIC_API_KEY: erro claro, sem chamada', async () => {
    const ia = criarClienteIa({ ...base, ANTHROPIC_API_KEY: undefined, LITELLM_URL: url });
    await expect(ia.gerar({ tarefa: 'resumo', prompt: 'x' })).rejects.toThrow(/ANTHROPIC_API_KEY/);
    expect(chamadas).toHaveLength(0);
  });
});

describe('exigirConfigIa (falha fechada)', () => {
  const sem = { IA_HABILITADA: true, ANTHROPIC_API_KEY: undefined };
  it('produção (ou NODE_ENV ausente) com IA ligada e sem chave: não sobe', () => {
    expect(() => exigirConfigIa({ ...sem, NODE_ENV_DECLARADO: 'production' })).toThrow(/ANTHROPIC_API_KEY/);
    expect(() => exigirConfigIa({ ...sem, NODE_ENV_DECLARADO: undefined })).toThrow(/ANTHROPIC_API_KEY/);
  });
  it('development/test declarados, IA desligada ou chave presente: sobe', () => {
    expect(() => exigirConfigIa({ ...sem, NODE_ENV_DECLARADO: 'development' })).not.toThrow();
    expect(() => exigirConfigIa({ ...sem, NODE_ENV_DECLARADO: 'test' })).not.toThrow();
    expect(() => exigirConfigIa({ IA_HABILITADA: false, ANTHROPIC_API_KEY: undefined, NODE_ENV_DECLARADO: 'production' })).not.toThrow();
    expect(() => exigirConfigIa({ IA_HABILITADA: true, ANTHROPIC_API_KEY: new Segredo('k'), NODE_ENV_DECLARADO: 'production' })).not.toThrow();
  });
});
