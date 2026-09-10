import type { PosicaoTile } from './movimento'
import type { SegmentoParede } from './tipos'

function chaveAresta(a: PosicaoTile, b: PosicaoTile): string {
  const [primeiro, segundo] = a.y === b.y ? [a, b].sort((p, q) => p.x - q.x) : [a, b].sort((p, q) => p.y - q.y)
  return `${primeiro.x},${primeiro.y}|${segundo.x},${segundo.y}`
}

/**
 * Converte a lista de paredes (segmentos de perímetro de zona, `gerarParedesDeZona`) numa função
 * `transicaoBloqueada(de, para)` pronta pra passar como último argumento de
 * `calcularProximaPosicao`. Paredes ficam exatamente sobre a linha de grade entre dois tiles - um
 * segmento horizontal em `y` bloqueia a passagem entre a fileira `y-1` e a fileira `y`, ao longo
 * de todo o seu `comprimento`; um vertical em `x` bloqueia entre a coluna `x-1` e `x`. Como as
 * portas já são um *vão* na lista de paredes (nenhum segmento cobrindo aquele trecho -
 * `gerarParedesDeZona`), elas automaticamente não bloqueiam nada aqui - sem lógica extra de porta.
 */
export function construirGradeColisao(paredes: SegmentoParede[]): (de: PosicaoTile, para: PosicaoTile) => boolean {
  const arestasBloqueadas = new Set<string>()

  for (const parede of paredes) {
    if (parede.orientacao === 'horizontal') {
      for (let tx = parede.x; tx < parede.x + parede.comprimento; tx++) {
        arestasBloqueadas.add(chaveAresta({ x: tx, y: parede.y - 1 }, { x: tx, y: parede.y }))
      }
    } else {
      for (let ty = parede.y; ty < parede.y + parede.comprimento; ty++) {
        arestasBloqueadas.add(chaveAresta({ x: parede.x - 1, y: ty }, { x: parede.x, y: ty }))
      }
    }
  }

  return function transicaoBloqueada(de: PosicaoTile, para: PosicaoTile): boolean {
    return arestasBloqueadas.has(chaveAresta(de, para))
  }
}
