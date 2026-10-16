import { describe, expect, it } from 'vitest'
import { calcularLimitesDoDia } from './limitesDoDia'

describe('calcularLimitesDoDia', () => {
  it('calcula meia-noite de Brasília de hoje até meia-noite de amanhã', () => {
    const agora = new Date('2026-01-15T14:32:07.123Z')

    expect(calcularLimitesDoDia(agora)).toEqual({
      inicio: '2026-01-15T03:00:00.000Z',
      fim: '2026-01-16T03:00:00.000Z',
    })
  })

  it('às 21h30 de Brasília (já dia seguinte em UTC) ainda é o mesmo dia', () => {
    const agora = new Date('2026-01-16T00:30:00Z')

    expect(calcularLimitesDoDia(agora)).toEqual({
      inicio: '2026-01-15T03:00:00.000Z',
      fim: '2026-01-16T03:00:00.000Z',
    })
  })

  it('vira o dia à meia-noite de Brasília', () => {
    const agora = new Date('2026-01-16T03:00:00.001Z')

    expect(calcularLimitesDoDia(agora)).toEqual({
      inicio: '2026-01-16T03:00:00.000Z',
      fim: '2026-01-17T03:00:00.000Z',
    })
  })
})
