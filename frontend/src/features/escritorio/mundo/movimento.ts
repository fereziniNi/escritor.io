export interface PosicaoTile {
  x: number
  y: number
}

/**
 * Calcula a próxima posição válida em tiles a partir de um delta de movimento - mesma lógica de
 * clamp que existia inline em `EscritorioPage.tsx` antes da migração pro mundo Pixi (o servidor
 * continua sendo a autoridade de verdade sobre limites do mapa, `ValidadorPosicaoMapa` - esse
 * clamp aqui é só cortesia visual, igual já era). `transicaoBloqueada`, quando informada (Fase 3 -
 * colisão com paredes, `construirGradeColisao`), recebe a posição atual E a próxima (não só a
 * próxima) porque paredes ficam na *aresta* entre dois tiles, não dentro de um tile - "tile de
 * destino bloqueado" não captura isso corretamente (o tile em si é sempre andável, o que pode
 * estar bloqueado é a borda entre ele e o tile atual).
 */
export function calcularProximaPosicao(
  atual: PosicaoTile,
  delta: readonly [number, number],
  limites: { larguraTiles: number; alturaTiles: number },
  transicaoBloqueada?: (de: PosicaoTile, para: PosicaoTile) => boolean,
): PosicaoTile {
  const novoX = Math.min(Math.max(atual.x + delta[0], 0), limites.larguraTiles - 1)
  const novoY = Math.min(Math.max(atual.y + delta[1], 0), limites.alturaTiles - 1)
  const proxima = { x: novoX, y: novoY }

  if (transicaoBloqueada?.(atual, proxima)) {
    return atual
  }

  return proxima
}
