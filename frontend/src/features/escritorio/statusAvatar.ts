import type { StatusAvatar } from './types'

export const OPCOES_STATUS: StatusAvatar[] = ['DISPONIVEL', 'FOCO', 'REUNIAO', 'ALMOCO', 'AUSENTE']

export const ROTULO_STATUS: Record<StatusAvatar, string> = {
  DISPONIVEL: 'Disponível',
  FOCO: 'Foco',
  REUNIAO: 'Reunião',
  ALMOCO: 'Almoço',
  AUSENTE: 'Ausente',
}
