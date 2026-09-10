import { describe, expect, it } from 'vitest'
import type { Zona } from '../types'
import { gerarParedesDeZona } from './gerarParedesDeZona'

const CABINE_1: Zona = { id: 1, nome: 'Cabine 1', x: 0, y: 0, largura: 4, altura: 4, tipo: 'CABINE' }

describe('gerarParedesDeZona', () => {
  it('gera as 4 paredes de perímetro de uma zona retangular', () => {
    const paredes = gerarParedesDeZona([{ ...CABINE_1, altura: 3 }], 'sul')

    // norte e oeste/leste ficam inteiras (a porta pedida é na borda sul, não nessas)
    expect(paredes).toContainEqual({ x: 0, y: 0, orientacao: 'horizontal', comprimento: 4 })
    expect(paredes).toContainEqual({ x: 0, y: 0, orientacao: 'vertical', comprimento: 3 })
    expect(paredes).toContainEqual({ x: 4, y: 0, orientacao: 'vertical', comprimento: 3 })
  })

  it('abre uma porta centralizada na borda pedida', () => {
    const paredes = gerarParedesDeZona([CABINE_1], 'sul')

    // pedido do usuário: "aumente o tamanho da porta" - vão de 2 tiles agora (era 1). Borda sul
    // (y=4, comprimento total 4): antesDaPorta = floor((4-2)/2) = 1, depoisDaPorta = 4-1-2 = 1
    const segmentosSul = paredes.filter((p) => p.orientacao === 'horizontal' && p.y === 4)
    expect(segmentosSul).toEqual([
      { x: 0, y: 4, orientacao: 'horizontal', comprimento: 1 },
      { x: 3, y: 4, orientacao: 'horizontal', comprimento: 1 },
    ])
    // soma dos dois pedaços + a porta (2 tiles) = comprimento original da parede
    const somaComPedacos = segmentosSul.reduce((total, p) => total + p.comprimento, 0)
    expect(somaComPedacos).toBe(2) // 4 - 2 (vão da porta)
  })

  it('pedido do usuário: "só é possível entrar por um lado" - a porta abre na borda escolhida, as outras 3 ficam inteiras', () => {
    const paredes = gerarParedesDeZona([CABINE_1], 'leste')

    // as 3 bordas sem porta ficam inteiras
    expect(paredes).toContainEqual({ x: 0, y: 0, orientacao: 'horizontal', comprimento: 4 })
    expect(paredes).toContainEqual({ x: 0, y: 4, orientacao: 'horizontal', comprimento: 4 })
    expect(paredes).toContainEqual({ x: 0, y: 0, orientacao: 'vertical', comprimento: 4 })
    // leste (vertical, x=4) é a única com o vão
    const segmentosLeste = paredes.filter((p) => p.orientacao === 'vertical' && p.x === 4)
    expect(segmentosLeste.length).toBe(2)
  })

  it('não abre porta numa parede curta demais pra caber o vão', () => {
    const zonaEstreita: Zona = { id: 2, nome: 'Cabine estreita', x: 0, y: 0, largura: 1, altura: 1, tipo: 'CABINE' }
    const paredes = gerarParedesDeZona([zonaEstreita], 'sul')

    const segmentoSul = paredes.find((p) => p.orientacao === 'horizontal' && p.y === 1)
    expect(segmentoSul).toEqual({ x: 0, y: 1, orientacao: 'horizontal', comprimento: 1 })
  })

  it('concatena as paredes de várias zonas (a coluna de cabines, por exemplo)', () => {
    const cabine2: Zona = { id: 2, nome: 'Cabine 2', x: 0, y: 5, largura: 4, altura: 4, tipo: 'CABINE' }
    const paredes = gerarParedesDeZona([CABINE_1, cabine2], 'leste')

    expect(paredes.some((p) => p.y === 0)).toBe(true)
    expect(paredes.some((p) => p.y === 5)).toBe(true)
  })

  it('pedido do usuário: "coloque parede em todas [as áreas]" - aceita uma borda por ZONA (função), não só uma borda fixa pra todas', () => {
    const sala: Zona = { id: 3, nome: 'Sala de reunião', x: 10, y: 0, largura: 4, altura: 4, tipo: 'REUNIAO' }
    const paredes = gerarParedesDeZona([CABINE_1, sala], (zona) => (zona.tipo === 'CABINE' ? 'leste' : 'norte'))

    // Cabine 1: porta na borda leste (x=4), norte inteira
    expect(paredes).toContainEqual({ x: 0, y: 0, orientacao: 'horizontal', comprimento: 4 })
    expect(paredes.filter((p) => p.orientacao === 'vertical' && p.x === 4).length).toBe(2)
    // Sala de reunião: porta na borda norte (y=0), sul inteira
    expect(paredes).toContainEqual({ x: 10, y: 4, orientacao: 'horizontal', comprimento: 4 })
    expect(paredes.filter((p) => p.orientacao === 'horizontal' && p.y === 0 && p.x >= 10).length).toBe(2)
  })

  it('pedido do usuário: "quando a sala estiver fechada para uma pessoa, deve fechar visualmente também" - `null` fecha a zona por completo, sem vão nenhum', () => {
    const paredesFechada = gerarParedesDeZona([CABINE_1], null)
    const paredesAberta = gerarParedesDeZona([CABINE_1], 'leste')

    // fechada: as 4 bordas inteiras, sem nenhum vão - metade dos segmentos da aberta (1 por
    // borda em vez de 2 na que tem porta)
    expect(paredesFechada).toHaveLength(4)
    expect(paredesFechada).toContainEqual({ x: 0, y: 0, orientacao: 'horizontal', comprimento: 4 }) // norte
    expect(paredesFechada).toContainEqual({ x: 0, y: 4, orientacao: 'horizontal', comprimento: 4 }) // sul
    expect(paredesFechada).toContainEqual({ x: 0, y: 0, orientacao: 'vertical', comprimento: 4 }) // oeste
    expect(paredesFechada).toContainEqual({ x: 4, y: 0, orientacao: 'vertical', comprimento: 4 }) // leste, sem vão
    expect(paredesAberta.length).toBeGreaterThan(paredesFechada.length)
  })

  it('a função por zona também pode devolver `null` só pra algumas zonas (cabine cheia x sala normal)', () => {
    const cabineCheia: Zona = { id: 4, nome: 'Cabine cheia', x: 20, y: 0, largura: 4, altura: 4, tipo: 'CABINE' }
    const paredes = gerarParedesDeZona([CABINE_1, cabineCheia], (zona) => (zona.id === cabineCheia.id ? null : 'leste'))

    // CABINE_1 (não cheia): continua com a porta na borda leste
    expect(paredes.filter((p) => p.orientacao === 'vertical' && p.x === 4).length).toBe(2)
    // cabineCheia: leste virou parede inteira, sem vão
    expect(paredes).toContainEqual({ x: 24, y: 0, orientacao: 'vertical', comprimento: 4 })
  })
})
