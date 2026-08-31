import type { StatusAvatar, TipoZona } from './types'

/** Tipos de zona hoje mapeiam pras 4 salas por função do redesign (V24): FOCO = Área de trabalho,
 * REUNIAO = Sala de reunião, CAFE = Café, LIVRE = Fora do trabalho (lounge) - ATENDIMENTO não é
 * mais usado por nenhuma zona seedada, mas o mapeamento continua completo por tipo. */
export const ICONE_ZONA: Record<TipoZona, string> = {
  FOCO: '💻',
  REUNIAO: '🗣️',
  CAFE: '☕',
  ATENDIMENTO: '🛎️',
  LIVRE: '🛋️',
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

/** Tingimento do piso por tipo de zona (Fase 3 - "identidade espacial" de cada sala), translúcido
 * sobre o piso do mundo Pixi. REUNIAO ficou um pouco mais saturada que a paleta original (mapa em
 * DOM) porque o piso agora tem um tom azulado por baixo (tema claro pedido pelo usuário) - um azul
 * pastel igualmente claro somia contra o piso; um pouco mais forte volta a se distinguir. */
export const COR_ZONA: Record<TipoZona, string> = {
  FOCO: '#bfe3c4',
  REUNIAO: '#a6cdf0',
  CAFE: '#eccfa8',
  ATENDIMENTO: '#eac1c8',
  // lavanda em vez do verde pastel original - LIVRE agora é "Fora do trabalho" (lounge), precisa
  // se distinguir da Área de trabalho (FOCO), que também é esverdeada
  LIVRE: '#d9c8ea',
}
