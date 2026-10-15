import { describe, expect, it } from 'vitest'
import { formatarMesAno } from './formatarMarcacao'

describe('formatarMesAno', () => {
  it('formata o mês da API como nome do mês e ano', () => {
    expect(formatarMesAno('2026-10')).toBe('Outubro/2026')
    expect(formatarMesAno('2026-01')).toBe('Janeiro/2026')
    expect(formatarMesAno('2025-12')).toBe('Dezembro/2025')
  })
})
