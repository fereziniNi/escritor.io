import type { Zona } from '../types'
import type { BordaZona, SegmentoParede } from './tipos'

/** Largura da abertura de porta, em tiles. Começou em 1 - pedido do usuário depois de ver ao vivo:
 * "Aumente o tamanho da porta, acredito que esteja muito pequeno atualmente" - virou 2, dá pra
 * passar sem ficar espremido contra a quina da parede mesmo vindo na diagonal. */
const LARGURA_PORTA_TILES = 2

/**
 * Deriva as paredes de perímetro de uma lista de zonas (retângulo x/y/largura/altura, o mesmo dado
 * que `GET /mapas/ativo` já retorna) - sem precisar de nenhuma coluna nova no backend. Nasceu
 * escopado só pras cabines (pedido do usuário: "cabines... devem ter paredes e só é possível
 * entrar por um lado", uma borda só - elas formam uma coluna vertical, todas com a mesma
 * orientação de porta); pedido posterior ("coloque parede em todas [as áreas]") estendeu pro
 * escritório inteiro, e cada tipo de sala tem sua própria borda de porta (ver
 * `BORDA_PORTA_POR_TIPO` em `dadosMundo.ts`) - por isso `bordaComPorta` aceita tanto uma borda fixa
 * (uso antigo, ainda válido quando todas as zonas compartilham a mesma porta) quanto uma função
 * `(zona) => borda`. `null` (fixo ou devolvido pela função) fecha a zona por completo, sem vão
 * nenhum - pedido do usuário: "quando a sala estiver fechada para uma pessoa, deve fechar
 * visualmente também" (`CamadaMundo.tsx` devolve `null` pra uma cabine cheia, ver
 * `cabineEstaCheia`).
 */
export function gerarParedesDeZona(
  zonas: Zona[],
  bordaComPorta: BordaZona | null | ((zona: Zona) => BordaZona | null),
): SegmentoParede[] {
  const bordaDaZona = typeof bordaComPorta === 'function' ? bordaComPorta : () => bordaComPorta
  return zonas.flatMap((zona) => paredesDaZona(zona, bordaDaZona(zona)))
}

function paredesDaZona(zona: Zona, bordaComPorta: BordaZona | null): SegmentoParede[] {
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
