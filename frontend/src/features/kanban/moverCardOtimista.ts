import type { ProjetoDetalhe } from '../organizacao/types'

/**
 * Aplica a movimentação de um card no estado local antes da API confirmar (atualização
 * otimista) - o inverso (rollback) é só guardar o estado de antes e devolver ele no onError da
 * mutação, não precisa de outra função. Sempre retorna um objeto novo (nunca muta `projeto`), pra
 * o React re-renderizar a partir da referência trocada.
 */
export function moverCardOtimista(
  projeto: ProjetoDetalhe,
  cardId: number,
  colunaDestinoId: number,
  indice: number,
): ProjetoDetalhe {
  const cardMovido = projeto.colunas.flatMap((coluna) => coluna.cards).find((card) => card.id === cardId)
  if (!cardMovido) {
    return projeto
  }

  const colunas = projeto.colunas.map((coluna) => ({
    ...coluna,
    cards: coluna.cards.filter((card) => card.id !== cardId),
  }))

  const colunaDestino = colunas.find((coluna) => coluna.id === colunaDestinoId)
  if (!colunaDestino) {
    return projeto
  }

  const indiceClampado = Math.max(0, Math.min(indice, colunaDestino.cards.length))
  const cardsComOMovido = [...colunaDestino.cards]
  cardsComOMovido.splice(indiceClampado, 0, { ...cardMovido, colunaId: colunaDestinoId })
  colunaDestino.cards = cardsComOMovido

  return { ...projeto, colunas }
}
