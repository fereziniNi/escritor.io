import type { ColunaComCards } from './types'

export type AlvoDoDrop = { type: 'coluna'; colunaId: number } | { type: 'card'; colunaId: number; cardId: number }

/**
 * Traduz o "over" que o dnd-kit entrega no `onDragEnd` (uma coluna vazia, ou um card específico)
 * pro par (colunaId, indice) que a mutação de mover espera - sempre calculado sobre a lista de
 * cards da coluna de destino **sem** o card que está sendo arrastado, mesma convenção do backend
 * (`CardService.mover`, S3.8) e de `moverCardOtimista`.
 */
export function resolverMovimento(
  colunas: ColunaComCards[],
  cardAtivoId: number,
  alvo: AlvoDoDrop | undefined,
): { colunaId: number; indice: number } | null {
  if (!alvo) {
    return null
  }

  const colunaDestino = colunas.find((coluna) => coluna.id === alvo.colunaId)
  if (!colunaDestino) {
    return null
  }

  const cardsSemOAtivo = colunaDestino.cards.filter((card) => card.id !== cardAtivoId)

  if (alvo.type === 'coluna') {
    return { colunaId: alvo.colunaId, indice: cardsSemOAtivo.length }
  }

  const indice = cardsSemOAtivo.findIndex((card) => card.id === alvo.cardId)
  return { colunaId: alvo.colunaId, indice: indice === -1 ? cardsSemOAtivo.length : indice }
}
