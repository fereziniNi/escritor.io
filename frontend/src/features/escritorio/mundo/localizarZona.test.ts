import { describe, expect, it } from 'vitest'
import type { Zona } from '../types'
import { zonaContendo } from './localizarZona'

const ZONAS: Zona[] = [
  { id: 1, nome: 'Sala de reunião', x: 1, y: 1, largura: 7, altura: 6, tipo: 'REUNIAO' },
  { id: 5, nome: 'Happy Hour', x: 20, y: 1, largura: 7, altura: 6, tipo: 'HAPPY_HOUR' },
]

describe('zonaContendo', () => {
  it('encontra a zona que contém a posição', () => {
    expect(zonaContendo(ZONAS, 21, 2)).toEqual(ZONAS[1])
  })

  it('inclui a borda de início (x, y) da zona', () => {
    expect(zonaContendo(ZONAS, 20, 1)).toEqual(ZONAS[1])
  })

  it('exclui a borda de fim (x + largura, y + altura) da zona', () => {
    expect(zonaContendo(ZONAS, 27, 1)).toBeNull() // x = 20 + 7, já fora
    expect(zonaContendo(ZONAS, 20, 7)).toBeNull() // y = 1 + 6, já fora
  })

  it('retorna null quando a posição não está em nenhuma zona', () => {
    expect(zonaContendo(ZONAS, 15, 15)).toBeNull()
  })

  it('retorna null com uma lista de zonas vazia', () => {
    expect(zonaContendo([], 5, 5)).toBeNull()
  })
})
