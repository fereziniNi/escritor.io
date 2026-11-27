import { describe, expect, it } from 'vitest'
import { corDoProjeto } from './corDoProjeto'

describe('corDoProjeto', () => {
  it('devolve sempre a mesma cor para o mesmo id', () => {
    expect(corDoProjeto(7)).toEqual(corDoProjeto(7))
  })

  it('devolve um dos 6 pares da paleta, mesmo para ids diferentes', () => {
    const pares = new Set<string>()
    for (let id = 1; id <= 50; id++) {
      const { fundo, texto } = corDoProjeto(id)
      expect(fundo).toBeTruthy()
      expect(texto).toBeTruthy()
      pares.add(`${fundo}|${texto}`)
    }
    expect(pares.size).toBe(6)
  })
})
