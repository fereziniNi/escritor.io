export type TipoRegistroPonto = 'ENTRADA' | 'PAUSA_INICIO' | 'PAUSA_FIM' | 'SAIDA'

export interface EstadoAtualPonto {
  ultimoTipo: TipoRegistroPonto | null
  proximasOpcoes: TipoRegistroPonto[]
}

export interface RegistroPonto {
  id: number
  tipo: TipoRegistroPonto
  momento: string
  origem: string
}
