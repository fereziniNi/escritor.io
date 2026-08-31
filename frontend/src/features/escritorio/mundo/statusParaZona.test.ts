import { describe, expect, it } from 'vitest'
import type { Zona } from '../types'
import { calcularDestinoParaStatus } from './statusParaZona'

const ZONAS: Zona[] = [
  { id: 1, nome: 'Sala de reunião', x: 1, y: 1, largura: 7, altura: 6, tipo: 'REUNIAO' },
  { id: 2, nome: 'Café', x: 13, y: 1, largura: 6, altura: 6, tipo: 'CAFE' },
  { id: 3, nome: 'Área de trabalho', x: 1, y: 10, largura: 12, altura: 8, tipo: 'FOCO' },
  { id: 4, nome: 'Fora do trabalho', x: 16, y: 10, largura: 10, altura: 8, tipo: 'LIVRE' },
]

describe('calcularDestinoParaStatus', () => {
  it('leva FOCO pro centro da Área de trabalho', () => {
    expect(calcularDestinoParaStatus(ZONAS, 'FOCO')).toEqual({ x: 7, y: 14 })
  })

  it('leva REUNIAO pro centro da Sala de reunião', () => {
    expect(calcularDestinoParaStatus(ZONAS, 'REUNIAO')).toEqual({ x: 4, y: 4 })
  })

  it('leva ALMOCO pro centro do Café', () => {
    expect(calcularDestinoParaStatus(ZONAS, 'ALMOCO')).toEqual({ x: 16, y: 4 })
  })

  it('leva AUSENTE pro centro do Fora do trabalho', () => {
    expect(calcularDestinoParaStatus(ZONAS, 'AUSENTE')).toEqual({ x: 21, y: 14 })
  })

  it('DISPONIVEL não tem zona correspondente - não redireciona ninguém', () => {
    expect(calcularDestinoParaStatus(ZONAS, 'DISPONIVEL')).toBeNull()
  })

  it('retorna null se o mapa não tem a zona correspondente seedada', () => {
    expect(calcularDestinoParaStatus([], 'FOCO')).toBeNull()
  })
})
