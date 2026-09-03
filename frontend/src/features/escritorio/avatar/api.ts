import { apiFetch } from '../../../shared/api/http'
import type { Personagem } from './personagens'

export interface MeuUsuarioResponse {
  id: number
  nome: string
  personagem: Personagem
}

export async function buscarMeuUsuario(): Promise<MeuUsuarioResponse> {
  const response = await apiFetch('/usuarios/me')
  if (!response.ok) {
    throw new Error('Não foi possível carregar seu usuário')
  }
  return response.json()
}

export async function atualizarMeuPersonagem(personagem: Personagem): Promise<MeuUsuarioResponse> {
  const response = await apiFetch('/usuarios/me/aparencia', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ personagem }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível salvar o personagem')
  }
  return response.json()
}
