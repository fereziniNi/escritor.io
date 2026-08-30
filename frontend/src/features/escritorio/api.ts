import { apiFetch } from '../../shared/api/http'
import type { MapaAtivo } from './types'

export async function buscarMapaAtivo(): Promise<MapaAtivo> {
  const response = await apiFetch('/mapas/ativo')
  if (!response.ok) {
    throw new Error('Não foi possível carregar o mapa')
  }
  return response.json()
}
