import { describe, expect, it } from 'vitest'
import { calcularProximaPosicao } from './movimento'

const LIMITES = { larguraTiles: 20, alturaTiles: 15 }

describe('calcularProximaPosicao', () => {
  it('move na direção do delta quando dentro dos limites', () => {
    expect(calcularProximaPosicao({ x: 5, y: 5 }, [1, 0], LIMITES)).toEqual({ x: 6, y: 5 })
    expect(calcularProximaPosicao({ x: 5, y: 5 }, [0, -1], LIMITES)).toEqual({ x: 5, y: 4 })
  })

  it('não deixa passar da borda esquerda/superior do mapa', () => {
    expect(calcularProximaPosicao({ x: 0, y: 0 }, [-1, 0], LIMITES)).toEqual({ x: 0, y: 0 })
    expect(calcularProximaPosicao({ x: 0, y: 0 }, [0, -1], LIMITES)).toEqual({ x: 0, y: 0 })
  })

  it('não deixa passar da borda direita/inferior do mapa', () => {
    expect(calcularProximaPosicao({ x: 19, y: 14 }, [1, 0], LIMITES)).toEqual({ x: 19, y: 14 })
    expect(calcularProximaPosicao({ x: 19, y: 14 }, [0, 1], LIMITES)).toEqual({ x: 19, y: 14 })
  })

  it('sem tileBloqueado informado, não bloqueia nenhum movimento dentro dos limites', () => {
    expect(calcularProximaPosicao({ x: 5, y: 5 }, [1, 1], LIMITES)).toEqual({ x: 6, y: 6 })
  })

  it('recusa o movimento quando a transição de tile pra tile está bloqueada (parede)', () => {
    const bloqueada = (de: { x: number; y: number }, para: { x: number; y: number }) => de.x === 5 && para.x === 6
    expect(calcularProximaPosicao({ x: 5, y: 5 }, [1, 0], LIMITES, bloqueada)).toEqual({ x: 5, y: 5 })
  })

  it('permite o movimento quando a transição não está bloqueada', () => {
    const bloqueada = (de: { x: number; y: number }, para: { x: number; y: number }) => de.x === 5 && para.x === 6
    expect(calcularProximaPosicao({ x: 5, y: 5 }, [0, 1], LIMITES, bloqueada)).toEqual({ x: 5, y: 6 })
  })
})
