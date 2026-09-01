import { describe, expect, it } from 'vitest'
import { calcularLimitesDoDiaUtc } from './limitesDoDiaUtc'

describe('calcularLimitesDoDiaUtc', () => {
  it('calcula meia-noite UTC de hoje até meia-noite UTC de amanhã', () => {
    const agora = new Date('2026-01-15T14:32:07.123Z')

    expect(calcularLimitesDoDiaUtc(agora)).toEqual({
      inicio: '2026-01-15T00:00:00.000Z',
      fim: '2026-01-16T00:00:00.000Z',
    })
  })

  it('funciona pra um horário logo antes da virada do dia', () => {
    const agora = new Date('2026-01-15T23:59:59.999Z')

    expect(calcularLimitesDoDiaUtc(agora)).toEqual({
      inicio: '2026-01-15T00:00:00.000Z',
      fim: '2026-01-16T00:00:00.000Z',
    })
  })

  it('funciona pra um horário logo depois da virada do dia', () => {
    const agora = new Date('2026-01-16T00:00:00.001Z')

    expect(calcularLimitesDoDiaUtc(agora)).toEqual({
      inicio: '2026-01-16T00:00:00.000Z',
      fim: '2026-01-17T00:00:00.000Z',
    })
  })
})
