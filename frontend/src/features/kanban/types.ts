export interface Comentario {
  id: number
  cardId: number
  autorId: number
  texto: string
  criadoEm: string
}

export type TipoEventoCard =
  | 'CRIACAO'
  | 'MUDANCA_COLUNA'
  | 'MUDANCA_RESPONSAVEL'
  | 'INICIOU_TRABALHO'
  | 'PAUSOU_TRABALHO'
  | 'FINALIZOU_TRABALHO'

export interface EventoCard {
  id: number
  cardId: number
  autorId: number
  tipo: TipoEventoCard
  de: string | null
  para: string | null
  criadoEm: string
}

/** Estado do cronômetro de uma tarefa - "iniciadoEm" não nulo significa que há uma sessão aberta
 * agora (o front usa isso pra tocar o relógio ao vivo). `descricaoConclusao`/`concluidoEm` só
 * existem depois de Finalizar. */
export interface Cronometro {
  cardId: number
  iniciadoEm: string | null
  totalMinutosFechados: number
  descricaoConclusao: string | null
  concluidoEm: string | null
}

/** Pedido do usuário: widget global (canto superior direito, vermelho) da tarefa que a pessoa está
 * com o cronômetro rodando agora, em qualquer projeto - carrega `cardId`/`projetoId` pra navegar
 * direto até o card ao clicar. Só existe uma por vez (o backend impede 2 cronômetros
 * simultâneos do mesmo usuário), então nunca é uma lista. */
export interface CronometroAtivo {
  cardId: number
  cardTitulo: string
  projetoId: number
  iniciadoEm: string
  totalMinutosFechados: number
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
