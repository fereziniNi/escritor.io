// origem: skills-modelo/apps/api/src/ia/rastreio.ts
import { SpanStatusCode } from '@opentelemetry/api';
import { LangfuseSpanProcessor } from '@langfuse/otel';
import { type SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { type Segredo } from '../config/segredo';
import { mascararTexto } from './mascarar-conteudo';

/** O que o rastreio lê da configuração (subconjunto de `Config`). */
export interface ConfigRastreio {
  LANGFUSE_PUBLIC_KEY?: string | undefined;
  LANGFUSE_SECRET_KEY?: Segredo | undefined;
  LANGFUSE_URL?: string | undefined;
  LANGFUSE_CAPTURAR_CONTEUDO: boolean;
}

/** Uma chamada ao modelo. `entrada`/`saida` só viram atributo do span com LANGFUSE_CAPTURAR_CONTEUDO=true (e mascarados). */
export interface DadosGeracao {
  nome: string;
  modelo: string;
  entrada?: string | undefined;
  saida?: string | undefined;
  tokensEntrada: number;
  tokensSaida: number;
  /** Dólares; null = modelo fora da tabela de preços (o span sai sem custo). */
  custoUsd: number | null;
  /** Epoch em milissegundos. */
  inicio: number;
  fim: number;
  userId?: string | undefined;
  sessionId?: string | undefined;
  /** Só o TIPO do erro (nome da classe). Mensagem de erro pode trazer dado do prompt e nunca vai para o rastreio. */
  erro?: string | undefined;
}

export interface Rastreio {
  /** Há algum processador de span registrado. */
  readonly ativo: boolean;
  /** Quantos exportadores/processadores foram registrados (0 = tudo é no-op). */
  readonly exportadores: number;
  registrar(g: DadosGeracao): void;
  /** Descarrega o que está em fila e fecha. Chamar no desligamento. */
  encerrar(): Promise<void>;
}

const SEM_RASTREIO: Rastreio = { ativo: false, exportadores: 0, registrar: () => undefined, encerrar: () => Promise.resolve() };

/**
 * Rastreio de IA no Langfuse via OpenTelemetry. Só registra o exportador quando LANGFUSE_PUBLIC_KEY, LANGFUSE_SECRET_KEY e
 * LANGFUSE_URL estão as três presentes; sem elas é um no-op (nada vai à rede). Usa um provider PRÓPRIO (não registra global):
 * não interfere em outra instrumentação OpenTelemetry do processo. Com LANGFUSE_CAPTURAR_CONTEUDO=false (padrão) o span leva só
 * metadados: modelo, tokens, custo, duração, userId e sessionId. `processadoresExtras` serve aos testes (exportador em memória).
 */
export function criarRastreio(config: ConfigRastreio, opcoes: { processadoresExtras?: SpanProcessor[] } = {}): Rastreio {
  const processadores: SpanProcessor[] = [...(opcoes.processadoresExtras ?? [])];
  if (config.LANGFUSE_PUBLIC_KEY && config.LANGFUSE_SECRET_KEY && config.LANGFUSE_URL) {
    processadores.push(
      new LangfuseSpanProcessor({
        publicKey: config.LANGFUSE_PUBLIC_KEY,
        secretKey: config.LANGFUSE_SECRET_KEY.revelar(),
        baseUrl: config.LANGFUSE_URL,
      }),
    );
  }
  if (processadores.length === 0) return SEM_RASTREIO;

  const provider = new NodeTracerProvider({ spanProcessors: processadores });
  const tracer = provider.getTracer('multiplica-ia');
  return {
    ativo: true,
    exportadores: processadores.length,
    registrar(g) {
      try {
        const span = tracer.startSpan(g.nome, { startTime: g.inicio });
        span.setAttributes({
          'langfuse.observation.type': 'generation',
          'langfuse.observation.model.name': g.modelo,
          'gen_ai.request.model': g.modelo,
          'langfuse.observation.usage_details': JSON.stringify({ input: g.tokensEntrada, output: g.tokensSaida, total: g.tokensEntrada + g.tokensSaida }),
        });
        if (g.custoUsd !== null) span.setAttribute('langfuse.observation.cost_details', JSON.stringify({ total: g.custoUsd }));
        if (g.userId) span.setAttribute('user.id', g.userId);
        if (g.sessionId) span.setAttribute('session.id', g.sessionId);
        if (config.LANGFUSE_CAPTURAR_CONTEUDO) {
          if (g.entrada !== undefined) span.setAttribute('langfuse.observation.input', mascararTexto(g.entrada));
          if (g.saida !== undefined) span.setAttribute('langfuse.observation.output', mascararTexto(g.saida));
        }
        if (g.erro) {
          span.setAttribute('langfuse.observation.level', 'ERROR');
          span.setAttribute('langfuse.observation.status_message', g.erro);
          span.setStatus({ code: SpanStatusCode.ERROR, message: g.erro });
        }
        span.end(g.fim);
      } catch {
        // Observabilidade nunca derruba a chamada de IA.
      }
    },
    async encerrar() {
      await provider.shutdown();
    },
  };
}
