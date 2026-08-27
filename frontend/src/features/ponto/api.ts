import { apiFetch } from '../../shared/api/http'
import type { EstadoAtualPonto, RegistroPonto, TipoRegistroPonto } from './types'

export async function buscarEstadoAtual(): Promise<EstadoAtualPonto> {
  const response = await apiFetch('/ponto/estado-atual')
  if (!response.ok) {
    throw new Error('Não foi possível carregar o estado da marcação')
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
