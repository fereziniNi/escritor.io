export interface Equipe {
  id: number
  nome: string
  descricao: string | null
  ativa: boolean
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
