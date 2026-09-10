import { apiFetch } from '../../../shared/api/http'
import type { AparenciaAvatar } from './aparenciaAvatar'

export interface MeuUsuarioResponse {
  id: number
  nome: string
  email: string
  aparencia: AparenciaAvatar
}

export async function buscarMeuUsuario(): Promise<MeuUsuarioResponse> {
  const response = await apiFetch('/usuarios/me')
  if (!response.ok) {
    throw new Error('Não foi possível carregar seu usuário')
  }
  return response.json()
}

export async function atualizarMinhaAparencia(aparencia: AparenciaAvatar): Promise<MeuUsuarioResponse> {
  const response = await apiFetch('/usuarios/me/aparencia', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(aparencia),
  })
  if (!response.ok) {
    throw new Error('Não foi possível salvar a aparência')
  }
  return response.json()
}

export async function atualizarMeuPerfil(nome: string, email: string): Promise<MeuUsuarioResponse> {
  const response = await apiFetch('/usuarios/me/perfil', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, email }),
  })
  if (!response.ok) {
    if (response.status === 409) {
      throw new Error('Esse e-mail já está em uso por outra pessoa')
    }
    throw new Error('Não foi possível salvar o perfil')
  }
  return response.json()
}
