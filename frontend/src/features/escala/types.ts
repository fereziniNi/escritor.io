export type DiaSemana = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY'

export interface EscalaSemanal {
  id: number
  diaSemana: DiaSemana
  /** "HH:mm" (o backend manda com segundos, "HH:mm:ss" - os campos `time` do formulário só usam
   * os 5 primeiros caracteres). */
  horaInicio: string
  horaFim: string
}

export interface ItemEscalaSemanal {
  diaSemana: DiaSemana
  horaInicio: string
  horaFim: string
}

export interface EscalaExcecao {
  id: number
  /** "AAAA-MM-DD". */
  data: string
  trabalha: boolean
  horaInicio: string | null
  horaFim: string | null
  observacao: string | null
}

export interface SalvarExcecaoInput {
  data: string
  trabalha: boolean
  horaInicio?: string | null
  horaFim?: string | null
  observacao?: string | null
}

/** Um dia já mesclado (padrão semanal + exceção pontual) - ver `EscalaService#calcularEfetiva` no backend. */
export interface DiaEfetivo {
  data: string
  trabalha: boolean
  horaInicio: string | null
  horaFim: string | null
}

export interface EscalaEquipe {
  usuarioId: number
  usuarioNome: string
  dias: DiaEfetivo[]
}
