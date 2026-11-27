export type EstadoTarefa = 'A_FAZER' | 'EM_ANDAMENTO' | 'FEITO'

export interface Tarefa {
  cardId: number
  titulo: string
  projetoId: number
  projetoNome: string | null
  pessoal: boolean
  estado: EstadoTarefa
  prazo: string | null
  estimativaMinutos: number | null
  concluidoEm: string | null
  estadosDisponiveis: EstadoTarefa[]
}
