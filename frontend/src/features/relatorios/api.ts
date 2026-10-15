import { apiFetch } from '../../shared/api/http'
import type { Estatisticas, FechamentoMes } from './types'

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

/** `mes` no formato AAAA-MM. Só ADMIN. */
export async function buscarFechamentoMes(mes: string): Promise<FechamentoMes> {
  const response = await apiFetch(`/admin/ponto/fechamento-mensal?mes=${mes}`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar o fechamento do mês')
  }
  return response.json()
}

/** `Blob` do Excel (.xlsx) - o download é disparado por quem chama (mesmo motivo de `baixarEspelhoDoMesCsv`). */
export async function baixarFechamentoMesXlsx(mes: string): Promise<Blob> {
  const response = await apiFetch(`/admin/ponto/fechamento-mensal?formato=xlsx&mes=${mes}`)
  if (!response.ok) {
    throw new Error('Não foi possível exportar o fechamento do mês')
  }
  return response.blob()
}
