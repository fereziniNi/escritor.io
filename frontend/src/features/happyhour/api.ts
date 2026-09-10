import { apiFetch } from '../../shared/api/http'
import type { Atividade } from './types'

export async function listarAtividades(): Promise<Atividade[]> {
  const response = await apiFetch('/happy-hour/atividades')
  if (!response.ok) {
    throw new Error('Não foi possível carregar as atividades')
  }
  return response.json()
}

export async function sugerirAtividade(descricao: string): Promise<Atividade> {
  const response = await apiFetch('/happy-hour/atividades', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ descricao }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível sugerir a atividade')
  }
  return response.json()
}

export async function sortear(): Promise<Atividade> {
  const response = await apiFetch('/happy-hour/sortear', { method: 'POST' })
  if (!response.ok) {
    throw new Error('Não foi possível girar a roleta')
  }
  return response.json()
}

/** `204` (sem corpo) é um estado válido, "ninguém sorteou nada ainda" - mesmo padrão de
 * `buscarCronometroAtivo` (kanban). */
export async function buscarSorteioAtual(): Promise<Atividade | null> {
  const response = await apiFetch('/happy-hour/sorteio')
  if (response.status === 204) {
    return null
  }
  if (!response.ok) {
    throw new Error('Não foi possível carregar o sorteio atual')
  }
  return response.json()
}
