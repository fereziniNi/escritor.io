import type { StatusAvatar } from './types'

/** DISPONIVEL fica de fora de propósito (pedido do usuário: "tire disponível do status") - não é
 * mais selecionável no dock, embora o tipo/backend ainda reconheçam o valor (ex.: status inicial
 * de quem acabou de conectar, antes de escolher algo). */
export const OPCOES_STATUS: StatusAvatar[] = ['FOCO', 'REUNIAO', 'ALMOCO', 'AUSENTE']

export const ROTULO_STATUS: Record<StatusAvatar, string> = {
  DISPONIVEL: 'Disponível',
  FOCO: 'Trabalhando',
  REUNIAO: 'Reunião',
  ALMOCO: 'Almoço',
  AUSENTE: 'Ausente',
}
