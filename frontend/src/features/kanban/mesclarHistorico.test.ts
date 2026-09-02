import { describe, expect, it } from 'vitest'
import { mesclarHistorico } from './mesclarHistorico'
import type { Apontamento, EventoCard } from './types'

function evento(parcial: Partial<EventoCard>): EventoCard {
  return { id: 1, cardId: 7, autorId: 1, tipo: 'CRIACAO', de: null, para: null, criadoEm: '2026-01-15T09:00:00Z', ...parcial }
}

function apontamento(parcial: Partial<Apontamento>): Apontamento {
  return {
    id: 1,
    usuarioId: 1,
    cardId: 7,
    inicio: '2026-01-15T09:00:00Z',
    fim: '2026-01-15T09:30:00Z',
    minutos: 30,
    descricao: null,
    origem: 'TIMER',
    criadoEm: '2026-01-15T09:00:00Z',
    editadoEm: '2026-01-15T09:30:00Z',
    ...parcial,
  }
}

describe('mesclarHistorico', () => {
  it('intercala eventos e apontamentos em ordem cronológica', () => {
    const linhas = mesclarHistorico(
      [
        evento({ id: 1, tipo: 'CRIACAO', para: 'A fazer', criadoEm: '2026-01-15T09:00:00Z' }),
        evento({ id: 2, tipo: 'MUDANCA_COLUNA', de: 'A fazer', para: 'Em progresso', criadoEm: '2026-01-15T11:00:00Z' }),
      ],
      [apontamento({ id: 5, inicio: '2026-01-15T10:00:00Z', fim: '2026-01-15T10:45:00Z', minutos: 45 })],
    )

    expect(linhas.map((linha) => linha.rotulo)).toEqual([
      'Card criado em "A fazer"',
      '45 min apontados (timer)',
      'Movido de "A fazer" para "Em progresso"',
    ])
  })

  it('ordena um apontamento manual pelo início do intervalo, não por quando foi lançado', () => {
    const linhas = mesclarHistorico(
      [evento({ id: 1, tipo: 'CRIACAO', para: 'A fazer', criadoEm: '2026-01-15T09:00:00Z' })],
      [
        apontamento({
          id: 9,
          origem: 'MANUAL',
          inicio: '2026-01-14T08:00:00Z', // lançado depois, mas registra um intervalo anterior à criação
          fim: '2026-01-14T09:00:00Z',
          minutos: 60,
          criadoEm: '2026-01-16T12:00:00Z',
        }),
      ],
    )

    expect(linhas.map((linha) => linha.rotulo)).toEqual(['60 min apontados (lançamento manual)', 'Card criado em "A fazer"'])
  })

  it('lista vazia quando não há nem evento nem apontamento', () => {
    expect(mesclarHistorico([], [])).toEqual([])
  })

  it('chave é única entre evento e apontamento com o mesmo id numérico', () => {
    const linhas = mesclarHistorico([evento({ id: 5 })], [apontamento({ id: 5 })])

    expect(linhas.map((linha) => linha.chave)).toEqual(['evento-5', 'apontamento-5'])
  })
})
