/** Espelha `EstatisticasResponse` e os DTOs relacionados do backend (`relatorio/web`). */
export interface TarefaConcluida {
  cardId: number
  titulo: string
  nomeProjeto: string
  concluidoEm: string
  descricaoConclusao: string | null
}

export interface RankingPessoa {
  usuarioId: number
  nome: string
  valor: number
}

export interface EstatisticasPessoais {
  totalMinutosTrabalhados: number
  diasTrabalhados: number
  mediaMinutosPorDiaTrabalhado: number
  reunioesParticipadas: number
  tarefasConcluidas: number
  tarefasConcluidasDetalhe: TarefaConcluida[]
  /** Não filtrado pelo período - ver comentário do DTO no backend. */
  projetosConcluidos: number
  /** Sempre 24 posições, índice = hora do dia (UTC), 0-23. */
  minutosPorHoraDoDia: number[]
}

export interface EstatisticasEquipe {
  rankingHorasTrabalhadas: RankingPessoa[]
  rankingTarefasConcluidas: RankingPessoa[]
  rankingReunioes: RankingPessoa[]
  reunioesPorHoraDoDia: number[]
}

export interface Estatisticas {
  pessoal: EstatisticasPessoais
  equipe: EstatisticasEquipe
}
