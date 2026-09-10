import type { StatusAvatar } from './types'

// `ICONE_ZONA` (rótulo flutuante com nome+ícone por sala) existiu aqui até o pedido do usuário:
// "Remova os nomes das áreas" - `RotuloZona.tsx` foi removido por completo, não só desativado
// (mesmo espírito do que já tinha acontecido com as paredes antes: "removidos por completo, não
// só desativados").

export const ICONE_STATUS: Record<StatusAvatar, string> = {
  DISPONIVEL: '🟢',
  FOCO: '🎯',
  REUNIAO: '🗣️',
  ALMOCO: '🍽️',
  AUSENTE: '💤',
  OFFLINE: '📴',
}

/** Cor do corpo do personagem por status - dá pra ler o status à distância no mapa, sem precisar
 * do badge. OFFLINE fica bem apagada de propósito - o avatar já renderiza com alpha reduzido
 * (`AvatarPixi`), essa cor só aparece no badge/swatch da lista de presença. */
export const COR_STATUS: Record<StatusAvatar, string> = {
  DISPONIVEL: '#4f9f6f',
  FOCO: '#e0546f',
  REUNIAO: '#4472c4',
  ALMOCO: '#e8a33d',
  AUSENTE: '#8b8b9a',
  OFFLINE: '#c7c7d1',
}

// A cor de piso por zona (antes um tingimento translúcido fraco sobre um piso universal, Fase 3)
// virou material/textura de verdade por sala - ver `MATERIAL_POR_ZONA` em `mundo/spriteFactory.ts`
// (Fase 6), única fonte de cor de piso agora.
