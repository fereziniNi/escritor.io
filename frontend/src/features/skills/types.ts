export type Categoria = 'FUNDACAO' | 'SEGURANCA' | 'INTERFACE' | 'IA' | 'INFRA' | 'DADOS' | 'OUTRAS'
export type EstadoVersao = 'PUBLICADA' | 'PROPOSTA' | 'REJEITADA'

export const CATEGORIAS: Categoria[] = ['FUNDACAO', 'SEGURANCA', 'INTERFACE', 'IA', 'INFRA', 'DADOS', 'OUTRAS']

export interface Arquivo {
  caminho: string
  conteudo: string
}

export interface SkillResumo {
  slug: string
  nome: string
  descricao: string
  categoria: Categoria
  oficial: boolean
  arquivada: boolean
  versaoVigente: number
  propostaPendente: boolean
  atualizadaEm: string
}

export interface VersaoResumo {
  numero: number
  estado: EstadoVersao
  nome: string
  descricao: string
  categoria: Categoria
  mensagem: string | null
  /** Nulo quando o autor é o Sistema (importação do repositório). */
  autorId: number | null
  autorNome: string
  criadaEm: string
  decididaPorNome: string | null
  decididaEm: string | null
  motivoRejeicao: string | null
}

export interface SkillVersao {
  numero: number
  estado: EstadoVersao
  nome: string
  descricao: string
  categoria: Categoria
  promptUso: string | null
  tutorialInstalacao: string | null
  mensagem: string | null
  /** Nulo quando o autor é o Sistema (importação do repositório). */
  autorId: number | null
  autorNome: string
  criadaEm: string
  decididaPorNome: string | null
  decididaEm: string | null
  motivoRejeicao: string | null
  arquivos: Arquivo[]
}

export interface SkillDetalhe {
  slug: string
  oficial: boolean
  arquivada: boolean
  vigente: SkillVersao
  propostaPendente: VersaoResumo | null
}

export interface Proposta {
  slug: string
  nomeSkill: string
  numero: number
  autorNome: string
  criadaEm: string
  mensagem: string | null
}

export interface CriarSkillRequest {
  slug: string
  nome: string
  descricao: string
  categoria: Categoria
  promptUso: string
  tutorialInstalacao: string
  mensagem: string
  arquivos: Arquivo[]
}

export interface SalvarVersaoRequest {
  nome: string
  descricao: string
  categoria: Categoria
  promptUso: string
  tutorialInstalacao: string
  mensagem: string
  arquivos: Arquivo[]
}

export interface FiltroSkills {
  busca?: string
  categoria?: Categoria
  soOficiais?: boolean
  arquivadas?: boolean
}

export const ROTULO_CATEGORIA: Record<Categoria, string> = {
  FUNDACAO: 'Fundação',
  SEGURANCA: 'Segurança',
  INTERFACE: 'Interface',
  IA: 'IA',
  INFRA: 'Infraestrutura',
  DADOS: 'Dados',
  OUTRAS: 'Outras',
}
