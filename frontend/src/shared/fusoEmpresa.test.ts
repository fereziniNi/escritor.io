import { describe, expect, it } from 'vitest'
import { hojeNaEmpresa, inicioDoDiaNaEmpresa, mesAtualNaEmpresa } from './fusoEmpresa'

describe('fusoEmpresa', () => {
  it('às 21h30 de Brasília ainda é o mesmo dia, mesmo já sendo o dia seguinte em UTC', () => {
    const agora = new Date('2026-10-16T00:30:00Z')

    expect(hojeNaEmpresa(agora)).toBe('2026-10-15')
  })

  it('o mês só vira à meia-noite de Brasília', () => {
    expect(mesAtualNaEmpresa(new Date('2026-11-01T02:59:59Z'))).toBe('2026-10')
    expect(mesAtualNaEmpresa(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11')
  })

  it('meia-noite de Brasília é 03:00 UTC', () => {
    expect(inicioDoDiaNaEmpresa('2026-10-15')).toBe('2026-10-15T03:00:00.000Z')
  })
})
