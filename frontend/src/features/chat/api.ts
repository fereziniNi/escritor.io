import { apiFetch } from '../../shared/api/http'
import type { Conversa, Mensagem } from './types'

export async function listarConversas(): Promise<Conversa[]> {
  const response = await apiFetch('/chat/conversas')
  if (!response.ok) {
    throw new Error('Não foi possível carregar as conversas')
  }
  return response.json()
}

/** Get-or-create - chamar de novo com a mesma pessoa devolve a mesma conversa, nunca duplica. */
export async function abrirConversaDireta(usuarioId: number): Promise<Conversa> {
  const response = await apiFetch(`/chat/conversas/diretas/${usuarioId}`, { method: 'POST' })
  if (!response.ok) {
    throw new Error('Não foi possível abrir a conversa')
  }
  return response.json()
}

export async function listarMensagens(conversaId: number): Promise<Mensagem[]> {
  const response = await apiFetch(`/chat/conversas/${conversaId}/mensagens`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar as mensagens')
  }
  return response.json()
}

export async function enviarMensagem(conversaId: number, texto: string): Promise<Mensagem> {
  const response = await apiFetch(`/chat/conversas/${conversaId}/mensagens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível enviar a mensagem')
  }
  return response.json()
}

export async function marcarConversaComoLida(conversaId: number): Promise<void> {
  const response = await apiFetch(`/chat/conversas/${conversaId}/lida`, { method: 'POST' })
  if (!response.ok) {
    throw new Error('Não foi possível marcar a conversa como lida')
  }
}
