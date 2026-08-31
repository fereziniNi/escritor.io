import type { Zona } from '../types'
import type { BordaZona, PortaOverride, SegmentoParede } from './tipos'

/** Largura da abertura de porta, em tiles - grande o suficiente pro avatar (que ocupa bem menos
 * que um tile de largura visualmente) passar sem ficar espremido contra a quina da parede. */
const LARGURA_PORTA_TILES = 1

/**
 * Deriva as paredes de perímetro de cada `Zona` (retângulo x/y/largura/altura, o mesmo dado que
 * `GET /mapas/ativo` já retorna) - sem precisar de nenhuma coluna nova no backend. Por padrão
 * deixa uma porta centralizada na borda sul de cada zona; `overrides` permite escolher outra
 * borda por id de zona (ou nenhuma porta, uma zona por vez, via `dadosMundo.PORTAS_OVERRIDE`).
 */
export function gerarParedesDeZona(zonas: Zona[], overrides: PortaOverride[] = []): SegmentoParede[] {
  return zonas.flatMap((zona) => {
    const override = overrides.find((o) => o.zonaId === zona.id)
    return paredesDaZona(zona, override?.borda ?? 'sul')
  })
}

function paredesDaZona(zona: Zona, bordaComPorta: BordaZona): SegmentoParede[] {
  const { x, y, largura, altura } = zona

  const bordas: Record<BordaZona, SegmentoParede> = {
    norte: { x, y, orientacao: 'horizontal', comprimento: largura },
    sul: { x, y: y + altura, orientacao: 'horizontal', comprimento: largura },
    oeste: { x, y, orientacao: 'vertical', comprimento: altura },
    leste: { x: x + largura, y, orientacao: 'vertical', comprimento: altura },
  }

  return (Object.keys(bordas) as BordaZona[]).flatMap((borda) =>
    borda === bordaComPorta ? abrirPorta(bordas[borda]) : [bordas[borda]],
  )
}

/** Divide um segmento em dois, com um vão de `LARGURA_PORTA_TILES` centralizado no meio - se o
 * segmento for curto demais pra caber a porta, devolve o segmento inteiro sem abertura (uma
 * parede sem porta é menos ruim visualmente do que uma "porta" maior que a própria parede). */
function abrirPorta(segmento: SegmentoParede): SegmentoParede[] {
  const { comprimento } = segmento
  if (comprimento <= LARGURA_PORTA_TILES) {
    return [segmento]
  }

  const antesDaPorta = Math.floor((comprimento - LARGURA_PORTA_TILES) / 2)
  const depoisDaPorta = comprimento - antesDaPorta - LARGURA_PORTA_TILES

  const partes: SegmentoParede[] = []
  if (antesDaPorta > 0) {
    partes.push(segmentoDeslocado(segmento, 0, antesDaPorta))
  }
  if (depoisDaPorta > 0) {
    partes.push(segmentoDeslocado(segmento, antesDaPorta + LARGURA_PORTA_TILES, depoisDaPorta))
  }
  return partes
}

function segmentoDeslocado(segmento: SegmentoParede, deslocamento: number, comprimento: number): SegmentoParede {
  return segmento.orientacao === 'horizontal'
    ? { ...segmento, x: segmento.x + deslocamento, comprimento }
    : { ...segmento, y: segmento.y + deslocamento, comprimento }
}
