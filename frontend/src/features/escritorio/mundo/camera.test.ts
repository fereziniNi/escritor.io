import { describe, expect, it } from 'vitest'
import { calcularTransformCamera, suavizarCamera } from './camera'

describe('calcularTransformCamera', () => {
  it('centraliza o mundo quando ele é menor que a viewport', () => {
    const transform = calcularTransformCamera({
      jogadorX: 100,
      jogadorY: 80,
      larguraMundoPx: 640,
      alturaMundoPx: 480,
      larguraViewportPx: 900,
      alturaViewportPx: 700,
      zoom: 1,
    })

    expect(transform).toEqual({ x: 130, y: 110, scale: 1 })
  })

  it('segue o jogador quando o mundo é maior que a viewport e ele está longe das bordas', () => {
    const transform = calcularTransformCamera({
      jogadorX: 1000,
      jogadorY: 1000,
      larguraMundoPx: 2000,
      alturaMundoPx: 2000,
      larguraViewportPx: 900,
      alturaViewportPx: 700,
      zoom: 1,
    })

    expect(transform.x).toBe(900 / 2 - 1000)
    expect(transform.y).toBe(700 / 2 - 1000)
  })

  it('não deixa a câmera passar da borda esquerda/superior do mundo', () => {
    const transform = calcularTransformCamera({
      jogadorX: 10,
      jogadorY: 10,
      larguraMundoPx: 2000,
      alturaMundoPx: 2000,
      larguraViewportPx: 900,
      alturaViewportPx: 700,
      zoom: 1,
    })

    expect(transform.x).toBe(0)
    expect(transform.y).toBe(0)
  })

  it('não deixa a câmera passar da borda direita/inferior do mundo', () => {
    const transform = calcularTransformCamera({
      jogadorX: 1990,
      jogadorY: 1990,
      larguraMundoPx: 2000,
      alturaMundoPx: 2000,
      larguraViewportPx: 900,
      alturaViewportPx: 700,
      zoom: 1,
    })

    expect(transform.x).toBe(900 - 2000)
    expect(transform.y).toBe(700 - 2000)
  })

  it('aplica o zoom escalando a posição do jogador antes de centralizar', () => {
    const transform = calcularTransformCamera({
      jogadorX: 1000,
      jogadorY: 1000,
      larguraMundoPx: 2000,
      alturaMundoPx: 2000,
      larguraViewportPx: 900,
      alturaViewportPx: 700,
      zoom: 2,
    })

    expect(transform.scale).toBe(2)
    expect(transform.x).toBe(900 / 2 - 1000 * 2)
  })
})

describe('suavizarCamera', () => {
  it('aproxima o valor atual do alvo pela fração informada', () => {
    const atual = { x: 0, y: 0, scale: 1 }
    const alvo = { x: 100, y: 200, scale: 2 }

    const resultado = suavizarCamera(atual, alvo, 0.5)

    expect(resultado).toEqual({ x: 50, y: 100, scale: 1.5 })
  })

  it('não ultrapassa o alvo quando já está exatamente nele', () => {
    const transform = { x: 42, y: 7, scale: 1 }

    expect(suavizarCamera(transform, transform, 0.5)).toEqual(transform)
  })
})
