import { apiFetch } from '../../shared/api/http'
import type { PessoaBasica } from '../../shared/encontrarPessoaPorNome'
import type { Papel } from '../auth/types'
import type { Colaborador, Projeto, ProjetoDetalhe, StatusProjeto } from './types'

/** Pedido do cliente: referenciar pessoa por nome, não por id, em qualquer lugar do sistema -
 * `GET /usuarios/basico` é a versão enxuta (id+nome, sem papel/carga diária/email) de
 * `listarColaboradores`, aberta a qualquer autenticado (não só admin) pra alimentar o
 * autocomplete de "escolher uma pessoa" (`CampoPessoa`). */
export async function listarPessoas(): Promise<PessoaBasica[]> {
  const response = await apiFetch('/usuarios/basico')
  if (!response.ok) {
    throw new Error('Não foi possível carregar as pessoas cadastradas')
  }
  return response.json()
}

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

export async function buscarProjeto(id: number): Promise<ProjetoDetalhe> {
  const response = await apiFetch(`/projetos/${id}`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar o projeto')
  }
  return response.json()
}

/** Pedido do cliente: atribuição individual de pessoa ao projeto (o "sistema"), sem Equipe/Quadro
 * no meio. */
export async function adicionarMembroAoProjeto(dados: { projetoId: number; usuarioId: number }): Promise<void> {
  const response = await apiFetch(`/projetos/${dados.projetoId}/membros`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuarioId: dados.usuarioId }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível adicionar o membro ao projeto')
  }
}

/** Pedido do cliente: "o admin pode adicionar as seções de um projeto (a fazer, fazendo, feito,
 * revisão, testando)" - mesma permissão de `adicionarMembroAoProjeto` (GESTOR/ADMIN, ver
 * `ProjetoController`). `ordem` decide a posição da coluna no board; quem chama calcula o próximo
 * valor livre a partir das colunas já carregadas. `limiteWip` fica de fora por enquanto - não foi
 * pedido e o backend já aceita null. */
export async function criarColuna(dados: { projetoId: number; nome: string; ordem: number }): Promise<void> {
  const response = await apiFetch(`/projetos/${dados.projetoId}/colunas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: dados.nome, ordem: dados.ordem, limiteWip: null }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível criar a seção')
  }
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
