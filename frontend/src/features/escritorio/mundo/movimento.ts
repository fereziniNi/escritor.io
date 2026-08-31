export interface PosicaoTile {
  x: number
  y: number
}

/**
 * Calcula a próxima posição válida em tiles a partir de um delta de movimento - mesma lógica de
 * clamp que existia inline em `EscritorioPage.tsx` antes da migração pro mundo Pixi (o servidor
 * continua sendo a autoridade de verdade sobre limites do mapa, `ValidadorPosicaoMapa` - esse
 * clamp aqui é só cortesia visual, igual já era). `tileBloqueado`, quando informado (Fase 3 -
 * colisão com paredes), impede o movimento de *entrar* num tile bloqueado - devolve a posição
 * atual sem mudança, em vez de "empurrar" o jogador pra outro lugar.
 */
export function calcularProximaPosicao(
  atual: PosicaoTile,
  delta: readonly [number, number],
  limites: { larguraTiles: number; alturaTiles: number },
  tileBloqueado?: (x: number, y: number) => boolean,
): PosicaoTile {
  const novoX = Math.min(Math.max(atual.x + delta[0], 0), limites.larguraTiles - 1)
  const novoY = Math.min(Math.max(atual.y + delta[1], 0), limites.alturaTiles - 1)

  if (tileBloqueado?.(novoX, novoY)) {
    return atual
  }

  return { x: novoX, y: novoY }
}
