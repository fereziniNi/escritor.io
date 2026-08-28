import { describe, expect, it } from 'vitest'
import { moverCardOtimista } from './moverCardOtimista'
import type { QuadroDetalhe } from './types'

function card(id: number, colunaId: number, titulo: string) {
  return {
    id,
    colunaId,
    titulo,
    descricao: null,
    posicao: id * 1000,
    responsavelId: null,
    prazo: null,
    estimativaMinutos: null,
    criadoPorId: 1,
    criadoEm: '2026-01-15T09:00:00Z',
    arquivado: false,
  }
}

const QUADRO: QuadroDetalhe = {
  id: 1,
  nome: 'Backlog',
  projetoId: null,
  equipeId: 10,
  arquivado: false,
  colunas: [
    { id: 100, nome: 'A fazer', ordem: 0, limiteWip: null, cards: [card(1, 100, 'Card 1'), card(2, 100, 'Card 2')] },
    { id: 200, nome: 'Em progresso', ordem: 1, limiteWip: null, cards: [card(3, 200, 'Card 3')] },
  ],
}

describe('moverCardOtimista', () => {
  it('move o card pra outra coluna, no índice pedido', () => {
    const resultado = moverCardOtimista(QUADRO, 1, 200, 0)

    const origem = resultado.colunas.find((c) => c.id === 100)!
    const destino = resultado.colunas.find((c) => c.id === 200)!
    expect(origem.cards.map((c) => c.id)).toEqual([2])
    expect(destino.cards.map((c) => c.id)).toEqual([1, 3])
    expect(destino.cards[0].colunaId).toBe(200)
  })

  it('reordena dentro da mesma coluna', () => {
    const resultado = moverCardOtimista(QUADRO, 2, 100, 0)

    const coluna = resultado.colunas.find((c) => c.id === 100)!
    expect(coluna.cards.map((c) => c.id)).toEqual([2, 1])
  })

  it('insere no fim quando o índice é maior que o tamanho da coluna', () => {
    const resultado = moverCardOtimista(QUADRO, 1, 200, 99)

    const destino = resultado.colunas.find((c) => c.id === 200)!
    expect(destino.cards.map((c) => c.id)).toEqual([3, 1])
  })

  it('card inexistente retorna o quadro sem alterações', () => {
    const resultado = moverCardOtimista(QUADRO, 999, 200, 0)

    expect(resultado).toBe(QUADRO)
  })

  it('nunca muta o objeto original (imutabilidade pro React re-renderizar)', () => {
    const resultado = moverCardOtimista(QUADRO, 1, 200, 0)

    expect(resultado).not.toBe(QUADRO)
    expect(QUADRO.colunas[0].cards).toHaveLength(2)
  })
})
