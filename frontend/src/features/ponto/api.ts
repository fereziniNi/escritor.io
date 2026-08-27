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

export async function buscarEspelhoDoMes(): Promise<EspelhoMes> {
  const response = await apiFetch('/ponto/espelho-do-mes')
  if (!response.ok) {
    throw new Error('Não foi possível carregar o espelho do mês')
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
