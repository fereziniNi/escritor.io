import { apiFetch } from '../../shared/api/http'
import type { Quadro } from './types'

export async function listarQuadros(): Promise<Quadro[]> {
  const response = await apiFetch('/quadros')
  if (!response.ok) {
    throw new Error('Não foi possível carregar os quadros')
  }
  return response.json()
}

export async function criarQuadro(dados: {
  nome: string
  projetoId: number | null
  equipeId: number | null
}): Promise<Quadro> {
  const response = await apiFetch('/quadros', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
  if (!response.ok) {
    throw new Error('Não foi possível criar o quadro')
  }
  return response.json()
}
