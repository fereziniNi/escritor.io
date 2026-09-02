export interface Comentario {
  id: number
  cardId: number
  autorId: number
  texto: string
  criadoEm: string
}

export type TipoEventoCard = 'CRIACAO' | 'MUDANCA_COLUNA' | 'MUDANCA_RESPONSAVEL'

export interface EventoCard {
  id: number
  cardId: number
  autorId: number
  tipo: TipoEventoCard
  de: string | null
  para: string | null
  criadoEm: string
}

export interface Apontamento {
  id: number
  usuarioId: number
  cardId: number
  inicio: string
  fim: string | null
  minutos: number | null
  descricao: string | null
  origem: 'TIMER' | 'MANUAL'
  criadoEm: string
  editadoEm: string
}

export interface TotalApontado {
  totalMinutos: number
}

/** Quanto tempo (fechado, apontamentos com `fim`) foi apontado num card específico num período -
 * usado pela "Jornada de hoje" (ponto) pra listar quanto tempo a pessoa trabalhou em cada tarefa
 * hoje, não só o agregado do dia. */
export interface TotalPorCard {
  cardId: number
  cardTitulo: string
  totalMinutos: number
}

export interface Card {
  id: number
  colunaId: number
  titulo: string
  descricao: string | null
  posicao: number
  responsavelId: number | null
  prazo: string | null
  estimativaMinutos: number | null
  criadoPorId: number
  criadoEm: string
  arquivado: boolean
}

export interface ColunaComCards {
  id: number
  nome: string
  ordem: number
  limiteWip: number | null
  cards: Card[]
}
