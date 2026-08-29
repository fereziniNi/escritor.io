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

export type EstadoDia = 'ABERTA' | 'FECHADA' | 'INCONSISTENTE'

export interface JornadaDoDia {
  data: string
  estado: EstadoDia
  minutosTrabalhados: number
  saldoDia: number
  saldoAcumuladoNoPeriodo: number
  totalApontadoMinutos: number
}

export interface EspelhoDia {
  data: string
  estado: EstadoDia
  minutosTrabalhados: number
  saldoDia: number
}

export interface EspelhoMes {
  dias: EspelhoDia[]
  saldoAcumuladoNoPeriodo: number
}
