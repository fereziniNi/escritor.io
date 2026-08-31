import { describe, expect, it } from 'vitest'
import type { Zona } from '../types'
import { gerarParedesDeZona } from './gerarParedesDeZona'

const SALA_DE_FOCO: Zona = { id: 1, nome: 'Sala de foco', x: 0, y: 0, largura: 4, altura: 4, tipo: 'FOCO' }

describe('gerarParedesDeZona', () => {
  it('gera as 4 paredes de perímetro de uma zona retangular', () => {
    const paredes = gerarParedesDeZona([{ ...SALA_DE_FOCO, altura: 3 }])

    // norte e oeste/leste ficam inteiras (largura=4 tem porta na borda sul, não nessas)
    expect(paredes).toContainEqual({ x: 0, y: 0, orientacao: 'horizontal', comprimento: 4 })
    expect(paredes).toContainEqual({ x: 0, y: 0, orientacao: 'vertical', comprimento: 3 })
    expect(paredes).toContainEqual({ x: 4, y: 0, orientacao: 'vertical', comprimento: 3 })
  })

  it('abre uma porta centralizada na borda sul por padrão', () => {
    const paredes = gerarParedesDeZona([SALA_DE_FOCO])

    // borda sul (y=4, comprimento total 4) vira dois pedaços de 1.5 tile... como largura da porta
    // é 1 e comprimento 4: antesDaPorta = floor((4-1)/2) = 1, depoisDaPorta = 4-1-1 = 2
    const segmentosSul = paredes.filter((p) => p.orientacao === 'horizontal' && p.y === 4)
    expect(segmentosSul).toEqual([
      { x: 0, y: 4, orientacao: 'horizontal', comprimento: 1 },
      { x: 2, y: 4, orientacao: 'horizontal', comprimento: 2 },
    ])
    // soma dos dois pedaços + a porta (1 tile) = comprimento original da parede
    const somaComPedacos = segmentosSul.reduce((total, p) => total + p.comprimento, 0)
    expect(somaComPedacos).toBe(3) // 4 - 1 (vão da porta)
  })

  it('respeita um override de borda de porta diferente da sul', () => {
    const paredes = gerarParedesDeZona([SALA_DE_FOCO], [{ zonaId: 1, borda: 'oeste' }])

    // sul agora fica inteira
    expect(paredes).toContainEqual({ x: 0, y: 4, orientacao: 'horizontal', comprimento: 4 })
    // oeste (vertical, x=0) que tem a porta
    const segmentosOeste = paredes.filter((p) => p.orientacao === 'vertical' && p.x === 0)
    expect(segmentosOeste.length).toBe(2)
  })

  it('não abre porta numa parede curta demais pra caber o vão', () => {
    const zonaEstreita: Zona = { id: 2, nome: 'Cabine', x: 0, y: 0, largura: 1, altura: 1, tipo: 'LIVRE' }
    const paredes = gerarParedesDeZona([zonaEstreita])

    const segmentoSul = paredes.find((p) => p.orientacao === 'horizontal' && p.y === 1)
    expect(segmentoSul).toEqual({ x: 0, y: 1, orientacao: 'horizontal', comprimento: 1 })
  })

  it('concatena as paredes de várias zonas', () => {
    const outraZona: Zona = { id: 2, nome: 'Café', x: 10, y: 0, largura: 4, altura: 4, tipo: 'CAFE' }
    const paredes = gerarParedesDeZona([SALA_DE_FOCO, outraZona])

    expect(paredes.some((p) => p.x === 10)).toBe(true)
    expect(paredes.some((p) => p.x === 0)).toBe(true)
  })
})
