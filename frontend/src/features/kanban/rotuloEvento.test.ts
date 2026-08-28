import { describe, expect, it } from 'vitest'
import { rotuloEvento } from './rotuloEvento'
import type { EventoCard } from './types'

function evento(parcial: Partial<EventoCard>): EventoCard {
  return {
    id: 1,
    cardId: 1,
    autorId: 1,
    tipo: 'CRIACAO',
    de: null,
    para: null,
    criadoEm: '2026-01-15T09:00:00Z',
    ...parcial,
  }
}

describe('rotuloEvento', () => {
  it('criação: card criado direto na coluna', () => {
    const rotulo = rotuloEvento(evento({ tipo: 'CRIACAO', de: null, para: 'A fazer' }))

    expect(rotulo).toBe('Card criado em "A fazer"')
  })

  it('mudança de coluna: de uma coluna pra outra', () => {
    const rotulo = rotuloEvento(evento({ tipo: 'MUDANCA_COLUNA', de: 'A fazer', para: 'Em progresso' }))

    expect(rotulo).toBe('Movido de "A fazer" para "Em progresso"')
  })

  it('mudança de responsável: com de e para preenchidos', () => {
    const rotulo = rotuloEvento(evento({ tipo: 'MUDANCA_RESPONSAVEL', de: 'Ana', para: 'Beto' }))

    expect(rotulo).toBe('Responsável alterado de Ana para Beto')
  })

  it('mudança de responsável: sem responsável anterior', () => {
    const rotulo = rotuloEvento(evento({ tipo: 'MUDANCA_RESPONSAVEL', de: null, para: 'Beto' }))

    expect(rotulo).toBe('Responsável definido como Beto')
  })

  it('tipo desconhecido usa um rótulo genérico em vez de quebrar', () => {
    const rotulo = rotuloEvento(evento({ tipo: 'ALGO_NOVO' as EventoCard['tipo'], de: 'X', para: 'Y' }))

    expect(rotulo).toBe('Evento: ALGO_NOVO')
  })
})
