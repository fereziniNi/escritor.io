import Anthropic from '@anthropic-ai/sdk';
import { type Config } from '../config/config';
import { calcularCusto } from './custo';
import { modeloPara } from './modelo';
import { type Rastreio, criarRastreio } from './rastreio';

/** O que o cliente lê da configuração (subconjunto de `Config`). */
export type ConfigIa = Pick<Config, 'IA_HABILITADA' | 'ANTHROPIC_API_KEY' | 'LITELLM_URL'>;

export class ErroIaDesabilitada extends Error {
  constructor() {
    super('IA desabilitada neste ambiente');
    this.name = 'ErroIaDesabilitada';
  }
}

export interface PedidoIa {
  /** Nome da tarefa (`resumo`): escolhe o modelo por `modeloPara` e dá nome ao span. */
  tarefa: string;
  prompt: string;
  system?: string;
  maxTokens?: number;
  userId?: string;
  sessionId?: string;
}

export interface RespostaIa {
  texto: string;
  modelo: string;
  tokensEntrada: number;
  tokensSaida: number;
  /** Dólares; null quando o modelo não está em ia/custo.ts. */
  custoUsd: number | null;
}

export interface ClienteIa {
  gerar(pedido: PedidoIa): Promise<RespostaIa>;
}

/**
 * Falha fechada no boot (chamada pelo IaModule): IA ligada fora de development/test declarados sem ANTHROPIC_API_KEY não sobe.
 * NODE_ENV ausente conta como produção (config.NODE_ENV_DECLARADO).
 */
export function exigirConfigIa(config: Pick<Config, 'IA_HABILITADA' | 'ANTHROPIC_API_KEY' | 'NODE_ENV_DECLARADO'>): void {
  if (!config.IA_HABILITADA || config.ANTHROPIC_API_KEY !== undefined) return;
  if (config.NODE_ENV_DECLARADO === 'development' || config.NODE_ENV_DECLARADO === 'test') return;
  throw new Error('IA_HABILITADA=true exige ANTHROPIC_API_KEY (ou ANTHROPIC_API_KEY_ARQUIVO) fora de desenvolvimento');
}

/**
 * Cliente de IA do padrão Multiplica sobre o `@anthropic-ai/sdk`. `baseURL` é `LITELLM_URL` quando definida (gateway LiteLLM); senão
 * a API da Anthropic. IA_HABILITADA=false: `gerar` lança ErroIaDesabilitada sem tocar a rede. Cada chamada vira um span de geração
 * no Langfuse (rastreio opcional). A tarefa escolhe o modelo por `modeloPara`.
 */
export function criarClienteIa(config: ConfigIa, deps: { rastreio?: Rastreio; env?: Record<string, string | undefined> } = {}): ClienteIa {
  const rastreio = deps.rastreio ?? criarRastreio({ LANGFUSE_CAPTURAR_CONTEUDO: false });
  let sdk: Anthropic | undefined;
  const obterSdk = (): Anthropic => {
    if (config.ANTHROPIC_API_KEY === undefined) throw new Error('ANTHROPIC_API_KEY ausente: defina a chave (ou ANTHROPIC_API_KEY_ARQUIVO)');
    sdk ??= new Anthropic({
      apiKey: config.ANTHROPIC_API_KEY.revelar(),
      ...(config.LITELLM_URL ? { baseURL: config.LITELLM_URL } : {}),
      timeout: 60_000,
      maxRetries: 2,
    });
    return sdk;
  };

  return {
    async gerar(pedido) {
      if (!config.IA_HABILITADA) throw new ErroIaDesabilitada();
      const modelo = modeloPara(pedido.tarefa, deps.env);
      const cliente = obterSdk();
      const inicio = Date.now();
      const base = { nome: pedido.tarefa, modelo, entrada: pedido.prompt, userId: pedido.userId, sessionId: pedido.sessionId, inicio };
      try {
        const msg = await cliente.messages.create({
          model: modelo,
          max_tokens: pedido.maxTokens ?? 1024,
          ...(pedido.system ? { system: pedido.system } : {}),
          messages: [{ role: 'user', content: pedido.prompt }],
        });
        // Só blocos de texto: com raciocínio adaptativo a resposta pode trazer blocos `thinking` antes do texto.
        const texto = msg.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('');
        const tokensEntrada = msg.usage.input_tokens;
        const tokensSaida = msg.usage.output_tokens;
        const custoUsd = calcularCusto(modelo, { entrada: tokensEntrada, saida: tokensSaida });
        rastreio.registrar({ ...base, saida: texto, tokensEntrada, tokensSaida, custoUsd, fim: Date.now() });
        return { texto, modelo, tokensEntrada, tokensSaida, custoUsd };
      } catch (e) {
        rastreio.registrar({ ...base, tokensEntrada: 0, tokensSaida: 0, custoUsd: null, fim: Date.now(), erro: e instanceof Error ? e.constructor.name : 'Erro' });
        throw e;
      }
    },
  };
}
