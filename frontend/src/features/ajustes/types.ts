import type { TipoRegistroPonto } from '../ponto/types'

export type StatusSolicitacaoAjuste = 'PENDENTE' | 'APROVADA' | 'REJEITADA'

export interface SolicitacaoAjuste {
  id: number
  tipoSolicitado: TipoRegistroPonto
  momentoSolicitado: string
  registroAlvoId: number | null
  justificativa: string
  status: StatusSolicitacaoAjuste
}

export interface SolicitacaoAjusteResumo extends SolicitacaoAjuste {
  usuarioId: number
  usuarioNome: string
  criadoEm: string
}
