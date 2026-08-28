export interface Quadro {
  id: number
  nome: string
  projetoId: number | null
  equipeId: number | null
  arquivado: boolean
}

export interface Etiqueta {
  id: number
  quadroId: number
  nome: string
  cor: string
}

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
  etiquetas: Etiqueta[]
}

export interface ColunaComCards {
  id: number
  nome: string
  ordem: number
  limiteWip: number | null
  cards: Card[]
}

export interface QuadroDetalhe {
  id: number
  nome: string
  projetoId: number | null
  equipeId: number | null
  arquivado: boolean
  colunas: ColunaComCards[]
}
