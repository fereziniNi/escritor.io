export type TipoZona = 'FOCO' | 'REUNIAO' | 'CAFE' | 'ATENDIMENTO' | 'LIVRE'

export type StatusAvatar = 'DISPONIVEL' | 'FOCO' | 'REUNIAO' | 'ALMOCO' | 'AUSENTE'

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
}
