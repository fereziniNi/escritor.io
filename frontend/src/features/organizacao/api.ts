import { apiFetch } from '../../shared/api/http'
import type { Papel } from '../auth/types'
import type { Colaborador, Projeto, StatusProjeto } from './types'

export async function listarProjetos(): Promise<Projeto[]> {
  const response = await apiFetch('/projetos')
  if (!response.ok) {
    throw new Error('Não foi possível carregar os projetos')
  }
  return response.json()
}

export async function criarProjeto(
  nome: string,
  cliente: string,
  status: StatusProjeto,
  inicio: string,
): Promise<Projeto> {
  const response = await apiFetch('/projetos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, cliente, status, inicio }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível criar o projeto')
  }
  return response.json()
}

export async function listarColaboradores(): Promise<Colaborador[]> {
  const response = await apiFetch('/usuarios')
  if (!response.ok) {
    throw new Error('Não foi possível carregar os colaboradores')
  }
  return response.json()
}

export async function criarColaborador(dados: {
  nome: string
  email: string
  papel: Papel
  cargaDiariaMinutos: number
}): Promise<Colaborador> {
  const response = await apiFetch('/usuarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
  if (!response.ok) {
    throw new Error('Não foi possível criar o colaborador')
  }
  return response.json()
}

/** Único campo editável hoje pra quem já existe (pedido do usuário: "o admin deve definir [a
 * carga diária] pros outros funcionários, não deve ser padrão") - nome/email/papel não têm tela
 * de edição ainda. */
export async function atualizarCargaDiaria(colaboradorId: number, cargaDiariaMinutos: number): Promise<Colaborador> {
  const response = await apiFetch(`/usuarios/${colaboradorId}/carga-diaria`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cargaDiariaMinutos }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível atualizar a carga diária')
  }
  return response.json()
}
