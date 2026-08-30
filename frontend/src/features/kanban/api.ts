import { apiFetch } from '../../shared/api/http'
import type { Apontamento, Card, Comentario, Etiqueta, EventoCard, Quadro, QuadroDetalhe, TotalApontado } from './types'

export async function listarQuadros(): Promise<Quadro[]> {
  const response = await apiFetch('/quadros')
  if (!response.ok) {
    throw new Error('Não foi possível carregar os quadros')
  }
  return response.json()
}

export async function criarQuadro(dados: {
  nome: string
  projetoId: number | null
  equipeId: number | null
}): Promise<Quadro> {
  const response = await apiFetch('/quadros', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
  if (!response.ok) {
    throw new Error('Não foi possível criar o quadro')
  }
  return response.json()
}

export async function buscarQuadro(id: number): Promise<QuadroDetalhe> {
  const response = await apiFetch(`/quadros/${id}`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar o quadro')
  }
  return response.json()
}

export async function criarCard(dados: { colunaId: number; titulo: string }): Promise<Card> {
  const response = await apiFetch(`/colunas/${dados.colunaId}/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ titulo: dados.titulo }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível criar o card')
  }
  return response.json()
}

export async function moverCard(dados: { cardId: number; colunaId: number; indice: number }): Promise<Card> {
  const response = await apiFetch(`/cards/${dados.cardId}/mover`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ colunaId: dados.colunaId, indice: dados.indice }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível mover o card')
  }
  return response.json()
}

export async function listarEtiquetas(quadroId: number): Promise<Etiqueta[]> {
  const response = await apiFetch(`/quadros/${quadroId}/etiquetas`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar as etiquetas')
  }
  return response.json()
}

export async function criarEtiqueta(dados: { quadroId: number; nome: string; cor: string }): Promise<Etiqueta> {
  const response = await apiFetch(`/quadros/${dados.quadroId}/etiquetas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: dados.nome, cor: dados.cor }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível criar a etiqueta')
  }
  return response.json()
}

export async function aplicarEtiqueta(dados: { cardId: number; etiquetaId: number }): Promise<Etiqueta> {
  const response = await apiFetch(`/cards/${dados.cardId}/etiquetas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ etiquetaId: dados.etiquetaId }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível aplicar a etiqueta')
  }
  return response.json()
}

export async function removerEtiqueta(dados: { cardId: number; etiquetaId: number }): Promise<void> {
  const response = await apiFetch(`/cards/${dados.cardId}/etiquetas/${dados.etiquetaId}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error('Não foi possível remover a etiqueta')
  }
}

export async function listarComentarios(cardId: number): Promise<Comentario[]> {
  const response = await apiFetch(`/cards/${cardId}/comentarios`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar os comentários')
  }
  return response.json()
}

export async function criarComentario(dados: { cardId: number; texto: string }): Promise<Comentario> {
  const response = await apiFetch(`/cards/${dados.cardId}/comentarios`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto: dados.texto }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível comentar')
  }
  return response.json()
}

export async function listarEventos(cardId: number): Promise<EventoCard[]> {
  const response = await apiFetch(`/cards/${cardId}/eventos`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar o histórico')
  }
  return response.json()
}

export async function iniciarTimer(cardId: number): Promise<Apontamento> {
  const response = await apiFetch(`/cards/${cardId}/apontamentos/timer`, { method: 'POST' })
  if (!response.ok) {
    throw new Error('Não foi possível iniciar o timer')
  }
  return response.json()
}

export async function pararTimer(apontamentoId: number): Promise<Apontamento> {
  const response = await apiFetch(`/apontamentos/${apontamentoId}/parar`, { method: 'PATCH' })
  if (!response.ok) {
    throw new Error('Não foi possível parar o timer')
  }
  return response.json()
}

export async function listarApontamentos(cardId: number): Promise<Apontamento[]> {
  const response = await apiFetch(`/cards/${cardId}/apontamentos`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar os apontamentos')
  }
  return response.json()
}

export async function criarApontamentoManual(dados: {
  cardId: number
  inicio: string | null
  fim: string | null
  minutos: number | null
  descricao: string | null
}): Promise<Apontamento> {
  const response = await apiFetch(`/cards/${dados.cardId}/apontamentos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inicio: dados.inicio, fim: dados.fim, minutos: dados.minutos, descricao: dados.descricao }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível lançar o apontamento')
  }
  return response.json()
}

export async function editarApontamento(dados: {
  apontamentoId: number
  inicio: string | null
  fim: string | null
  descricao: string | null
}): Promise<Apontamento> {
  const response = await apiFetch(`/apontamentos/${dados.apontamentoId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inicio: dados.inicio, fim: dados.fim, descricao: dados.descricao }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível editar o apontamento')
  }
  return response.json()
}

export async function excluirApontamento(apontamentoId: number): Promise<void> {
  const response = await apiFetch(`/apontamentos/${apontamentoId}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error('Não foi possível excluir o apontamento')
  }
}

export async function buscarTotalApontadoPorProjetoOuEquipe(dados: {
  projetoId: number | null
  equipeId: number | null
  inicio: string
  fim: string
}): Promise<TotalApontado> {
  const filtro = dados.projetoId ? `projetoId=${dados.projetoId}` : `equipeId=${dados.equipeId}`
  const response = await apiFetch(
    `/apontamentos/relatorio?${filtro}&inicio=${encodeURIComponent(dados.inicio)}&fim=${encodeURIComponent(dados.fim)}`,
  )
  if (!response.ok) {
    throw new Error('Não foi possível carregar o total apontado')
  }
  return response.json()
}
