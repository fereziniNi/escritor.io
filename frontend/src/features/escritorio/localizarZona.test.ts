import { describe, expect, it } from 'vitest'
import { localizarZona } from './localizarZona'
import type { Zona } from './types'

const FOCO: Zona = { id: 1, nome: 'Sala de foco', x: 0, y: 0, largura: 4, altura: 4, tipo: 'FOCO' }
const REUNIAO: Zona = { id: 2, nome: 'Sala de reunião', x: 5, y: 0, largura: 5, altura: 5, tipo: 'REUNIAO' }
const ZONAS = [FOCO, REUNIAO]

describe('localizarZona', () => {
  it('retorna a zona quando a posição está dentro dela', () => {
    expect(localizarZona(ZONAS, 1, 1)).toEqual(FOCO)
  })

  it('inclui o canto superior esquerdo da zona', () => {
    expect(localizarZona(ZONAS, 0, 0)).toEqual(FOCO)
  })

  it('exclui o limite direito/inferior da zona (x/y + largura/altura)', () => {
    expect(localizarZona(ZONAS, 4, 0)).toBeNull()
    expect(localizarZona(ZONAS, 0, 4)).toBeNull()
  })

  it('retorna a segunda zona quando a posição cai nela', () => {
    expect(localizarZona(ZONAS, 6, 1)).toEqual(REUNIAO)
  })

  it('retorna null fora de qualquer zona', () => {
    expect(localizarZona(ZONAS, 8, 8)).toBeNull()
  })
})
