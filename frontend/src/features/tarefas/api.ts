import { apiFetch } from '../../shared/api/http'
import type { EstadoTarefa, Tarefa } from './types'

export async function listarMinhasTarefas(): Promise<Tarefa[]> {
  const response = await apiFetch('/tarefas/minhas')
  if (!response.ok) {
    throw new Error('Não foi possível carregar as tarefas')
  }
  return response.json()
}

export async function criarTarefa(dados: {
  titulo: string
  projetoId: number | null
  prazo: string | null
  estimativaMinutos: number | null
}): Promise<Tarefa> {
  const response = await apiFetch('/tarefas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
  if (!response.ok) {
    throw new Error('Não foi possível criar a tarefa')
  }
  return response.json()
}

export async function mudarEstadoTarefa(cardId: number, estado: EstadoTarefa): Promise<Tarefa> {
  const response = await apiFetch(`/tarefas/${cardId}/estado`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado }),
  })
  if (response.status === 409) {
    throw new Error('Não foi possível mudar o estado (limite de tarefas em andamento ou tarefa já finalizada)')
  }
  if (!response.ok) {
    throw new Error('Não foi possível mudar o estado')
  }
  return response.json()
}
