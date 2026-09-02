import type { Papel } from '../auth/types'
import type { ColunaComCards } from '../kanban/types'

/** {@code Papel} vem de `features/auth/types.ts` - o mesmo enum de papel usado no login também
 * descreve o papel de cada colaborador aqui. */
export interface Colaborador {
  id: number
  nome: string
  email: string
  papel: Papel
  cargaDiariaMinutos: number
  ativo: boolean
}

export type StatusProjeto = 'ATIVO' | 'PAUSADO' | 'CONCLUIDO'

export interface Projeto {
  id: number
  nome: string
  cliente: string
  status: StatusProjeto
  inicio: string
  fimPrevisto: string | null
}

/** Pedido do cliente: sem Equipe/Quadro separado - pessoa é atribuída direto ao projeto (o
 * "sistema"), e essa atribuição é também a regra de visibilidade. */
export interface MembroProjeto {
  usuarioId: number
  usuarioNome: string
}

/** Projeto virou o próprio quadro de trabalho - detalhe traz colunas/cards (kanban) e membros
 * junto com os dados administrativos que `Projeto` já tinha. */
export interface ProjetoDetalhe {
  id: number
  nome: string
  cliente: string
  status: StatusProjeto
  inicio: string
  fimPrevisto: string | null
  colunas: ColunaComCards[]
  membros: MembroProjeto[]
}
