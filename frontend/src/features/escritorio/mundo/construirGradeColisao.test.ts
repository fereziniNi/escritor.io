import { describe, expect, it } from 'vitest'
import { construirGradeColisao } from './construirGradeColisao'
import { gerarParedesDeZona } from './gerarParedesDeZona'
import type { Zona } from '../types'
import type { SegmentoParede } from './tipos'

const CABINE: Zona = { id: 1, nome: 'Cabine 1', x: 0, y: 0, largura: 4, altura: 4, tipo: 'CABINE' }

describe('construirGradeColisao', () => {
  it('bloqueia a transição entre dois tiles separados por uma parede horizontal', () => {
    const paredes: SegmentoParede[] = [{ x: 0, y: 4, orientacao: 'horizontal', comprimento: 4 }]
    const bloqueada = construirGradeColisao(paredes)

    expect(bloqueada({ x: 1, y: 3 }, { x: 1, y: 4 })).toBe(true)
    expect(bloqueada({ x: 1, y: 4 }, { x: 1, y: 3 })).toBe(true) // funciona nos dois sentidos
  })

  it('bloqueia a transição entre dois tiles separados por uma parede vertical', () => {
    const paredes: SegmentoParede[] = [{ x: 4, y: 0, orientacao: 'vertical', comprimento: 4 }]
    const bloqueada = construirGradeColisao(paredes)

    expect(bloqueada({ x: 3, y: 2 }, { x: 4, y: 2 })).toBe(true)
  })

  it('não bloqueia transições que não cruzam nenhuma parede', () => {
    const paredes: SegmentoParede[] = [{ x: 0, y: 4, orientacao: 'horizontal', comprimento: 4 }]
    const bloqueada = construirGradeColisao(paredes)

    expect(bloqueada({ x: 10, y: 10 }, { x: 10, y: 11 })).toBe(false)
    expect(bloqueada({ x: 1, y: 3 }, { x: 2, y: 3 })).toBe(false)
  })

  it('pedido do usuário: "só é possível entrar por um lado" - deixa passar pelo vão da porta, sem lógica extra', () => {
    const paredes = gerarParedesDeZona([CABINE], 'sul')
    const bloqueada = construirGradeColisao(paredes)

    // a porta fica na borda sul (y=4, comprimento 4 -> antesDaPorta=floor((4-1)/2)=1 -> vão em x=1)
    expect(bloqueada({ x: 1, y: 3 }, { x: 1, y: 4 })).toBe(false)
    // mas o resto da borda sul continua parede de verdade
    expect(bloqueada({ x: 0, y: 3 }, { x: 0, y: 4 })).toBe(true)
    expect(bloqueada({ x: 3, y: 3 }, { x: 3, y: 4 })).toBe(true)
    // e as outras 3 bordas (sem porta) continuam totalmente bloqueadas
    expect(bloqueada({ x: -1, y: 1 }, { x: 0, y: 1 })).toBe(true) // oeste
    expect(bloqueada({ x: 4, y: 1 }, { x: 3, y: 1 })).toBe(true) // leste
  })
})
