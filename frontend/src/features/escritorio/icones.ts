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

/** Tingimento do piso por tipo de zona (Fase 3 - "identidade espacial" de cada sala) - mesma
 * paleta usada quando o mapa ainda era renderizado em DOM, agora aplicada como um tingimento
 * translúcido sobre o piso do mundo Pixi em vez de background sólido de um `<div>`. */
export const COR_ZONA: Record<TipoZona, string> = {
  FOCO: '#bfe3c4',
  REUNIAO: '#bfd6ec',
  CAFE: '#eccfa8',
  ATENDIMENTO: '#eac1c8',
  LIVRE: '#dbe8d6',
}
