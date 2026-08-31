import { describe, expect, it } from 'vitest'
import { interpolarPosicao } from './glide'

describe('interpolarPosicao', () => {
  it('fica na posição anterior quando o progresso é 0', () => {
    expect(interpolarPosicao({ x: 5, y: 5 }, { x: 8, y: 9 }, 0)).toEqual({ x: 5, y: 5 })
  })

  it('chega no alvo quando o progresso é 1', () => {
    expect(interpolarPosicao({ x: 5, y: 5 }, { x: 8, y: 9 }, 1)).toEqual({ x: 8, y: 9 })
  })

  it('interpola linearmente no meio do caminho', () => {
    expect(interpolarPosicao({ x: 0, y: 0 }, { x: 10, y: 20 }, 0.5)).toEqual({ x: 5, y: 10 })
  })

  it('clampa progresso negativo na posição anterior', () => {
    expect(interpolarPosicao({ x: 5, y: 5 }, { x: 8, y: 9 }, -0.5)).toEqual({ x: 5, y: 5 })
  })

  it('clampa progresso acima de 1 no alvo', () => {
    expect(interpolarPosicao({ x: 5, y: 5 }, { x: 8, y: 9 }, 1.5)).toEqual({ x: 8, y: 9 })
  })
})
