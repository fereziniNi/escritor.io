import type { AparenciaAvatar } from './avatar/aparenciaAvatar'

export type TipoZona = 'FOCO' | 'REUNIAO' | 'CAFE' | 'ATENDIMENTO' | 'LIVRE'

/** OFFLINE é automático (backend marca quem desconecta, nunca escolhido manualmente - não aparece
 * em `OPCOES_STATUS`) - o avatar fica estacionado em "Fora do trabalho" até a pessoa reconectar. */
export type StatusAvatar = 'DISPONIVEL' | 'FOCO' | 'REUNIAO' | 'ALMOCO' | 'AUSENTE' | 'OFFLINE'

export interface Zona {
  id: number
  nome: string
  x: number
  y: number
  largura: number
  altura: number
  tipo: TipoZona
}

export interface MapaAtivo {
  id: number
  nome: string
  larguraTiles: number
  alturaTiles: number
  layoutJson: string
  zonas: Zona[]
}

export interface EstadoPresencaUsuario {
  usuarioId: number
  nome: string
  x: number
  y: number
  status: StatusAvatar
  aparencia: AparenciaAvatar
}
