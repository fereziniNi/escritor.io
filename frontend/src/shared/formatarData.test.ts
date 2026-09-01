import { describe, expect, it } from 'vitest'
import { formatarDataBr } from './formatarData'

describe('formatarDataBr', () => {
  it('formata uma data pura (AAAA-MM-DD) como DD/MM/AAAA', () => {
    expect(formatarDataBr('2026-01-05')).toBe('05/01/2026')
  })

  it('formata um instante ISO completo, ignorando a hora', () => {
    expect(formatarDataBr('2026-12-31T23:59:59Z')).toBe('31/12/2026')
  })

  it('não sofre desvio de fuso horário em datas no início do ano', () => {
    expect(formatarDataBr('2026-01-01')).toBe('01/01/2026')
  })
})
