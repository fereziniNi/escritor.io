import { apiFetch } from '../../shared/api/http'
import type { Card, Quadro, QuadroDetalhe } from './types'

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

export async function buscarQuadro(id: number): Promise<QuadroDetalhe> {
  const response = await apiFetch(`/quadros/${id}`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar o quadro')
  }
  return response.json()
}

export async function criarCard(dados: { colunaId: number; titulo: string }): Promise<Card> {
  const response = await apiFetch(`/colunas/${dados.colunaId}/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo: dados.titulo }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível criar o card')
  }
  return response.json()
}

export async function moverCard(dados: { cardId: number; colunaId: number; indice: number }): Promise<Card> {
  const response = await apiFetch(`/cards/${dados.cardId}/mover`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ colunaId: dados.colunaId, indice: dados.indice }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível mover o card')
  }
  return response.json()
}
