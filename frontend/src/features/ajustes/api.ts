import { apiFetch } from '../../shared/api/http'
import type { TipoRegistroPonto } from '../ponto/types'
import type { SolicitacaoAjuste, SolicitacaoAjusteResumo } from './types'

export async function solicitarAjuste(dados: {
  tipo: TipoRegistroPonto
  momento: string
  justificativa: string
}): Promise<SolicitacaoAjuste> {
  const response = await apiFetch('/ajustes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
  if (!response.ok) {
    throw new Error('Não foi possível enviar a solicitação')
  }
  return response.json()
}

export async function listarPendentes(): Promise<SolicitacaoAjusteResumo[]> {
  const response = await apiFetch('/ajustes/pendentes')
  if (!response.ok) {
    throw new Error('Não foi possível carregar as solicitações pendentes')
  }
  return response.json()
}

export async function aprovarSolicitacao(id: number): Promise<SolicitacaoAjuste> {
  const response = await apiFetch(`/ajustes/${id}/aprovar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parecer: null }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível aprovar a solicitação')
  }
  return response.json()
}

export async function rejeitarSolicitacao(id: number, parecer: string): Promise<SolicitacaoAjuste> {
  const response = await apiFetch(`/ajustes/${id}/rejeitar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ parecer }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível rejeitar a solicitação')
  }
  return response.json()
}
