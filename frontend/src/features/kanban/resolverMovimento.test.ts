import { describe, expect, it } from 'vitest'
import { resolverMovimento } from './resolverMovimento'
import type { ColunaComCards } from './types'

function card(id: number, colunaId: number) {
  return {
    id,
    colunaId,
    titulo: `Card ${id}`,
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

const COLUNAS: ColunaComCards[] = [
  { id: 100, nome: 'A fazer', ordem: 0, limiteWip: null, cards: [card(1, 100), card(2, 100)] },
  { id: 200, nome: 'Em progresso', ordem: 1, limiteWip: null, cards: [card(3, 200)] },
]

describe('resolverMovimento', () => {
  it('soltar sobre uma coluna vazia (ou no fim) manda pro fim da lista sem o próprio card', () => {
    const resultado = resolverMovimento(COLUNAS, 1, { type: 'coluna', colunaId: 200 })

    expect(resultado).toEqual({ colunaId: 200, indice: 1 })
  })

  it('soltar sobre um card manda pro índice desse card, na lista sem o próprio card', () => {
    const resultado = resolverMovimento(COLUNAS, 1, { type: 'card', colunaId: 100, cardId: 2 })

    // remove o card 1 da coluna 100 -> sobra só [2]; o card 2 fica no índice 0
    expect(resultado).toEqual({ colunaId: 100, indice: 0 })
  })

  it('soltar sobre um card de outra coluna calcula o índice já sem o card ativo', () => {
    const resultado = resolverMovimento(COLUNAS, 1, { type: 'card', colunaId: 200, cardId: 3 })

    expect(resultado).toEqual({ colunaId: 200, indice: 0 })
  })

  it('sem "over" (soltou fora de qualquer área) não resolve nada', () => {
    const resultado = resolverMovimento(COLUNAS, 1, undefined)

    expect(resultado).toBeNull()
  })

  it('over aponta pra um card que não existe mais cai pro fim da coluna', () => {
    const resultado = resolverMovimento(COLUNAS, 1, { type: 'card', colunaId: 100, cardId: 999 })

    expect(resultado).toEqual({ colunaId: 100, indice: 1 })
  })
})
