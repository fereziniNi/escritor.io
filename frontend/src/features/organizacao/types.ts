import type { Papel } from '../auth/types'

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
