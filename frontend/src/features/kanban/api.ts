import { apiFetch } from '../../shared/api/http'
import type { Card, Comentario, Cronometro, CronometroAtivo, EventoCard, TotalApontado, TotalPorCard } from './types'

/** Pedido do cliente: qualquer pessoa (não só admin/gestor) pode criar tarefa, atribuir a alguém
 * (por id do usuário - mesma disciplina de não montar dropdown pra API que não existe pra todo
 * mundo, ver comentário em `RelatoriosPage`) e definir quanto tempo ela deve levar. */
export async function criarCard(dados: {
  colunaId: number
  titulo: string
  responsavelId: number | null
  estimativaMinutos: number | null
}): Promise<Card> {
  const response = await apiFetch(`/colunas/${dados.colunaId}/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      titulo: dados.titulo,
      responsavelId: dados.responsavelId,
      estimativaMinutos: dados.estimativaMinutos,
    }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível criar a tarefa')
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

export async function buscarCronometro(cardId: number): Promise<Cronometro> {
  const response = await apiFetch(`/cards/${cardId}/cronometro`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar o cronômetro')
  }
  return response.json()
}

export async function iniciarCronometro(cardId: number): Promise<Cronometro> {
  const response = await apiFetch(`/cards/${cardId}/cronometro/iniciar`, { method: 'POST' })
  if (!response.ok) {
    throw new Error('Não foi possível iniciar o cronômetro')
  }
  return response.json()
}

export async function pausarCronometro(cardId: number): Promise<Cronometro> {
  const response = await apiFetch(`/cards/${cardId}/cronometro/pausar`, { method: 'POST' })
  if (!response.ok) {
    throw new Error('Não foi possível pausar o cronômetro')
  }
  return response.json()
}

export async function finalizarCronometro(cardId: number, descricao: string): Promise<Cronometro> {
  const response = await apiFetch(`/cards/${cardId}/cronometro/finalizar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ descricao }),
  })
  if (!response.ok) {
    throw new Error('Não foi possível finalizar a tarefa')
  }
  return response.json()
}

/** Pedido do usuário: widget global (canto superior direito) da tarefa com o cronômetro rodando
 * agora - `204` (sem corpo) é um estado válido, "ninguém rodando agora", não um erro. */
export async function buscarCronometroAtivo(): Promise<CronometroAtivo | null> {
  const response = await apiFetch('/cronometro/ativo')
  if (response.status === 204) {
    return null
  }
  if (!response.ok) {
    throw new Error('Não foi possível carregar o cronômetro ativo')
  }
  return response.json()
}

/** Quanto tempo foi apontado em cada card, num período - usado pela "Jornada de hoje" (ponto)
 * com `inicio`/`fim` do dia corrente. Sem `usuarioId`: o backend já assume "eu mesmo". */
export async function listarTotalApontadoPorCard(dados: { inicio: string; fim: string }): Promise<TotalPorCard[]> {
  const response = await apiFetch(
    `/apontamentos?agrupar=card&inicio=${encodeURIComponent(dados.inicio)}&fim=${encodeURIComponent(dados.fim)}`,
  )
  if (!response.ok) {
    throw new Error('Não foi possível carregar o tempo apontado por tarefa')
  }
  return response.json()
}

export async function buscarTotalApontadoPorProjeto(dados: {
  projetoId: number
  inicio: string
  fim: string
}): Promise<TotalApontado> {
  const response = await apiFetch(
    `/apontamentos/relatorio?projetoId=${dados.projetoId}&inicio=${encodeURIComponent(dados.inicio)}&fim=${encodeURIComponent(dados.fim)}`,
  )
  if (!response.ok) {
    throw new Error('Não foi possível carregar o total apontado')
  }
  return response.json()
}
