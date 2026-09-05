import { apiFetch } from '../../shared/api/http'
import type { DiaEfetivo, EscalaEquipe, EscalaExcecao, EscalaSemanal, ItemEscalaSemanal, SalvarExcecaoInput } from './types'

export async function listarEscalaSemanal(): Promise<EscalaSemanal[]> {
  const response = await apiFetch('/escala/semanal')
  if (!response.ok) {
    throw new Error('Não foi possível carregar o padrão semanal')
  }
  return response.json()
}

export async function definirEscalaSemanal(itens: ItemEscalaSemanal[]): Promise<EscalaSemanal[]> {
  const response = await apiFetch('/escala/semanal', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(itens),
  })
  if (!response.ok) {
    throw new Error('Não foi possível salvar o padrão semanal')
  }
  return response.json()
}

export async function listarExcecoesDaEscala(inicio: string, fim: string): Promise<EscalaExcecao[]> {
  const response = await apiFetch(`/escala/excecoes?inicio=${inicio}&fim=${fim}`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar as exceções da escala')
  }
  return response.json()
}

export async function salvarExcecaoDaEscala(dados: SalvarExcecaoInput): Promise<EscalaExcecao> {
  const response = await apiFetch('/escala/excecoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
  if (!response.ok) {
    throw new Error('Não foi possível salvar a exceção')
  }
  return response.json()
}

export async function removerExcecaoDaEscala(id: number): Promise<void> {
  const response = await apiFetch(`/escala/excecoes/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error('Não foi possível remover a exceção')
  }
}

export async function buscarEscalaEfetiva(inicio: string, fim: string): Promise<DiaEfetivo[]> {
  const response = await apiFetch(`/escala/efetiva?inicio=${inicio}&fim=${fim}`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar a escala do período')
  }
  return response.json()
}

export async function buscarEscalaDaEquipe(inicio: string, fim: string): Promise<EscalaEquipe[]> {
  const response = await apiFetch(`/escala/equipe?inicio=${inicio}&fim=${fim}`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar a escala da equipe')
  }
  return response.json()
}
