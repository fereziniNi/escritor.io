import { apiFetch } from '../../shared/api/http'
import type { Estatisticas } from './types'

export async function buscarEstatisticas(dados: { usuarioId: number | null; inicio: string; fim: string }): Promise<Estatisticas> {
  const usuarioIdQuery = dados.usuarioId ? `usuarioId=${dados.usuarioId}&` : ''
  const response = await apiFetch(
    `/relatorios/estatisticas?${usuarioIdQuery}inicio=${encodeURIComponent(dados.inicio)}&fim=${encodeURIComponent(dados.fim)}`,
  )
  if (!response.ok) {
    throw new Error('Não foi possível carregar as estatísticas')
  }
  return response.json()
}
