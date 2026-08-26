import { apiFetch } from '../../shared/api/http'
import type { Equipe, Projeto, StatusProjeto } from './types'

export async function listarEquipes(): Promise<Equipe[]> {
  const response = await apiFetch('/equipes')
  if (!response.ok) {
    throw new Error('Não foi possível carregar as equipes')
  }
  return response.json()
}

export async function criarEquipe(nome: string, descricao: string): Promise<Equipe> {
  const response = await apiFetch('/equipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, descricao: descricao || null }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível criar a equipe')
  }
  return response.json()
}

export async function listarProjetos(): Promise<Projeto[]> {
  const response = await apiFetch('/projetos')
  if (!response.ok) {
    throw new Error('Não foi possível carregar os projetos')
  }
  return response.json()
}

export async function criarProjeto(
  nome: string,
  cliente: string,
  status: StatusProjeto,
  inicio: string,
): Promise<Projeto> {
  const response = await apiFetch('/projetos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, cliente, status, inicio }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível criar o projeto')
  }
  return response.json()
}

export async function vincularEquipeAoProjeto(projetoId: number, equipeId: number): Promise<void> {
  const response = await apiFetch(`/projetos/${projetoId}/equipes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ equipeId }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível vincular a equipe ao projeto')
  }
}
