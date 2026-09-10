import { apiFetch } from '../../shared/api/http'
import type { Notificacoes } from './types'

export async function buscarNotificacoes(): Promise<Notificacoes> {
  const response = await apiFetch('/notificacoes')
  if (!response.ok) {
    throw new Error('Não foi possível carregar as notificações')
  }
  return response.json()
}

export async function marcarNotificacoesComoLidas(): Promise<void> {
  const response = await apiFetch('/notificacoes/marcar-lidas', { method: 'POST' })
  if (!response.ok) {
    throw new Error('Não foi possível marcar as notificações como lidas')
  }
}
