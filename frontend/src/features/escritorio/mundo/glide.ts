import type { PosicaoTile } from './movimento'

/** Duração alvo do glide (transição visual) entre dois tiles, em milissegundos - mesma sensação
 * do `transition: left 150ms ease-out` que o mapa em DOM usava. */
export const DURACAO_GLIDE_MS = 140

/**
 * Interpolação linear entre a posição anterior e o alvo - `progresso` vai de 0 (ainda na posição
 * anterior) a 1 (chegou no alvo), clampado nas pontas. O contrato com o servidor não muda: ele só
 * conhece posições inteiras em tile; isso é puramente a suavização visual de como o cliente
 * desenha a transição entre uma posição confirmada e a próxima.
 */
export function interpolarPosicao(anterior: PosicaoTile, alvo: PosicaoTile, progresso: number): PosicaoTile {
  const t = Math.min(Math.max(progresso, 0), 1)
  return {
    x: anterior.x + (alvo.x - anterior.x) * t,
    y: anterior.y + (alvo.y - anterior.y) * t,
  }
}
