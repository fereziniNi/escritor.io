// origem: skills-modelo/apps/api/src/ia/custo.ts
import { Logger } from '@nestjs/common';

export interface UsoTokens {
  entrada: number;
  saida: number;
}

/**
 * Preço em dólares por MILHÃO de tokens (entrada, saída) da API da Anthropic, conferido na skill claude-api em 2026-10-06.
 * Acrescente a linha ao adotar um modelo novo; modelo fora da tabela devolve custo null (nunca derruba a chamada).
 * Simplificações: o Haiku 5.5 cobra US$ 0,50 / US$ 2,50 acima de 100 mil tokens de prompt, e leitura de cache custa menos que a entrada —
 * aqui tudo é cobrado pela tarifa cheia, então o custo é um teto estimado. Gateway (LiteLLM) pode ter preço próprio: o custo oficial é o dele.
 */
export const PRECOS_POR_MILHAO: Readonly<Record<string, { entrada: number; saida: number }>> = {
  'claude-fable-5-1': { entrada: 10, saida: 50 },
  'claude-fable-5': { entrada: 10, saida: 50 },
  'claude-opus-5-5': { entrada: 4, saida: 20 },
  'claude-opus-5': { entrada: 5, saida: 25 },
  'claude-opus-4-8': { entrada: 5, saida: 25 },
  'claude-opus-4-7': { entrada: 5, saida: 25 },
  'claude-opus-4-6': { entrada: 5, saida: 25 },
  'claude-sonnet-5-5': { entrada: 2, saida: 10 },
  'claude-sonnet-5': { entrada: 2, saida: 10 },
  'claude-sonnet-4-6': { entrada: 3, saida: 15 },
  'claude-haiku-5-5': { entrada: 0.1, saida: 0.5 },
  'claude-haiku-4-5': { entrada: 1, saida: 5 },
};

const jaAvisados = new Set<string>();
const log = new Logger('IaCusto');

/** Custo em dólares de uma chamada, ou null (com um aviso por modelo) quando o modelo não está na tabela. */
export function calcularCusto(modelo: string, uso: UsoTokens, avisar: (mensagem: string) => void = (m) => log.warn(m)): number | null {
  const preco = Object.hasOwn(PRECOS_POR_MILHAO, modelo) ? PRECOS_POR_MILHAO[modelo] : undefined;
  if (preco === undefined) {
    if (!jaAvisados.has(modelo)) {
      jaAvisados.add(modelo);
      avisar(`Modelo "${modelo}" fora da tabela de preços (ia/custo.ts): custo registrado como desconhecido`);
    }
    return null;
  }
  return (uso.entrada * preco.entrada + uso.saida * preco.saida) / 1_000_000;
}
