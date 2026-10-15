import { apiFetch } from '../../shared/api/http'
import type { EspelhoMes, EstadoAtualPonto, JornadaDoDia, RegistroPonto, TipoRegistroPonto } from './types'

export async function buscarEstadoAtual(): Promise<EstadoAtualPonto> {
  const response = await apiFetch('/ponto/estado-atual')
  if (!response.ok) {
    throw new Error('Não foi possível carregar o estado da marcação')
  }
  return response.json()
}

export async function buscarJornadaDoDia(): Promise<JornadaDoDia> {
  const response = await apiFetch('/ponto/jornada-do-dia')
  if (!response.ok) {
    throw new Error('Não foi possível carregar a jornada do dia')
  }
  return response.json()
}

/** `mes` no formato AAAA-MM; ausente = mês corrente. */
function montarQuery(parametros: { usuarioId?: number; mes?: string; formato?: string }): string {
  const partes: string[] = []
  if (parametros.formato) partes.push(`formato=${parametros.formato}`)
  if (parametros.usuarioId) partes.push(`usuarioId=${parametros.usuarioId}`)
  if (parametros.mes) partes.push(`mes=${parametros.mes}`)
  return partes.length > 0 ? `?${partes.join('&')}` : ''
}

export async function buscarEspelhoDoMes(usuarioId?: number, mes?: string): Promise<EspelhoMes> {
  const response = await apiFetch(`/ponto/espelho-do-mes${montarQuery({ usuarioId, mes })}`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar o espelho do mês')
  }
  return response.json()
}

/** Meses (AAAA-MM) com marcação, do mais recente ao mais antigo; o mês corrente sempre vem. */
export async function buscarMesesDisponiveis(usuarioId?: number): Promise<string[]> {
  const response = await apiFetch(`/ponto/meses-disponiveis${montarQuery({ usuarioId })}`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar os meses disponíveis')
  }
  return response.json()
}

/**
 * Retorna o `Blob` do CSV (não JSON) - o download em si é responsabilidade de quem chama, já que
 * um link `<a href>` puro não carrega o header `Authorization` (S5.9).
 */
export async function baixarEspelhoDoMesCsv(usuarioId?: number, mes?: string): Promise<Blob> {
  const response = await apiFetch(`/ponto/espelho-do-mes${montarQuery({ usuarioId, mes, formato: 'csv' })}`)
  if (!response.ok) {
    throw new Error('Não foi possível exportar o espelho do mês')
  }
  return response.blob()
}

export async function buscarDiasInconsistentes(dados: {
  usuarioId: number | null
  inicio: string
  fim: string
}): Promise<string[]> {
  const usuarioIdQuery = dados.usuarioId ? `usuarioId=${dados.usuarioId}&` : ''
  const response = await apiFetch(
    `/ponto/dias-inconsistentes?${usuarioIdQuery}inicio=${encodeURIComponent(dados.inicio)}&fim=${encodeURIComponent(dados.fim)}`,
  )
  if (!response.ok) {
    throw new Error('Não foi possível carregar os dias inconsistentes')
  }
  return response.json()
}

export async function marcarPonto(tipo: TipoRegistroPonto): Promise<RegistroPonto> {
  const response = await apiFetch('/ponto/marcar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível registrar a marcação')
  }
  return response.json()
}
