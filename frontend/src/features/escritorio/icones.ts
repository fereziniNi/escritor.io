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
