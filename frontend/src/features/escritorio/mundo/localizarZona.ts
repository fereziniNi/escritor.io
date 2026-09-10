import type { Zona } from '../types'

/**
 * Espelha `LocalizadorZona.zonaContendo` do backend (mesma conta de bounding box) - usada só
 * client-side, pra saber em qual zona o próprio jogador está agora a partir da posição já
 * disponível (`usuarios[meuUsuarioId]`, WS de presença) e `mapa.zonas` (já carregados), sem
 * round-trip novo ao servidor. Pedido do usuário: "quando a pessoa entra [na sala Happy Hour]
 * aparece um modal pequeno" - `EscritorioPage` usa isso pra saber quando mostrar o mural.
 */
export function zonaContendo(zonas: Zona[], x: number, y: number): Zona | null {
  return zonas.find((zona) => x >= zona.x && x < zona.x + zona.largura && y >= zona.y && y < zona.y + zona.altura) ?? null
}
