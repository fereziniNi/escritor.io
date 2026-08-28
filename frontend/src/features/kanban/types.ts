export interface Quadro {
  id: number
  nome: string
  projetoId: number | null
  equipeId: number | null
  arquivado: boolean
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

export interface QuadroDetalhe {
  id: number
  nome: string
  projetoId: number | null
  equipeId: number | null
  arquivado: boolean
  colunas: ColunaComCards[]
}
