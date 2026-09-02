import { describe, expect, it } from 'vitest'
import { rotuloApontamento } from './rotuloApontamento'
import type { Apontamento } from './types'

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

describe('rotuloApontamento', () => {
  it('timer ainda em andamento (sem fim)', () => {
    expect(rotuloApontamento(apontamento({ fim: null, minutos: null }))).toBe('Timer iniciado, ainda em andamento')
  })

  it('timer encerrado, sem descrição', () => {
    expect(rotuloApontamento(apontamento({ origem: 'TIMER', minutos: 45, descricao: null }))).toBe('45 min apontados (timer)')
  })

  it('lançamento manual, com descrição', () => {
    expect(rotuloApontamento(apontamento({ origem: 'MANUAL', minutos: 60, descricao: 'Revisão de código' }))).toBe(
      '60 min apontados (lançamento manual) — Revisão de código',
    )
  })
})
