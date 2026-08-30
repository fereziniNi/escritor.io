import { describe, expect, it } from 'vitest'
import { calcularAtrasoReconexao } from './backoffReconexao'

describe('calcularAtrasoReconexao', () => {
  it('usa o atraso base na primeira tentativa', () => {
    expect(calcularAtrasoReconexao(0, 1000, 30000)).toBe(1000)
  })

  it('dobra a cada tentativa sucessiva', () => {
    expect(calcularAtrasoReconexao(1, 1000, 30000)).toBe(2000)
    expect(calcularAtrasoReconexao(2, 1000, 30000)).toBe(4000)
    expect(calcularAtrasoReconexao(3, 1000, 30000)).toBe(8000)
  })

  it('nunca ultrapassa o teto máximo', () => {
    expect(calcularAtrasoReconexao(10, 1000, 30000)).toBe(30000)
  })
})
