import type { StatusAvatar, TipoZona } from './types'

export const ICONE_ZONA: Record<TipoZona, string> = {
  FOCO: '🎯',
  REUNIAO: '🗣️',
  CAFE: '☕',
  ATENDIMENTO: '🛎️',
  LIVRE: '🌿',
}

export const ICONE_STATUS: Record<StatusAvatar, string> = {
  DISPONIVEL: '🟢',
  FOCO: '🎯',
  REUNIAO: '🗣️',
  ALMOCO: '🍽️',
  AUSENTE: '💤',
}

/** Cor do corpo do personagem por status - dá pra ler o status à distância no mapa, sem precisar do badge. */
export const COR_STATUS: Record<StatusAvatar, string> = {
  DISPONIVEL: '#4f9f6f',
  FOCO: '#e0546f',
  REUNIAO: '#4472c4',
  ALMOCO: '#e8a33d',
  AUSENTE: '#8b8b9a',
}
