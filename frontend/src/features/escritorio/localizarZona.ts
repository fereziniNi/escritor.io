import type { Zona } from './types'

/**
 * Mesma lógica geométrica de `LocalizadorZona` (backend, S6.7/S6.9) - mas aqui é só pra decidir
 * em qual seção da lista de presença (S6.9) cada usuário aparece, nunca pra decidir status
 * (isso é autoridade do servidor, ver `PresencaWebSocketHandler`).
 */
export function localizarZona(zonas: Zona[], x: number, y: number): Zona | null {
  return zonas.find((zona) => x >= zona.x && x < zona.x + zona.largura && y >= zona.y && y < zona.y + zona.altura) ?? null
}
