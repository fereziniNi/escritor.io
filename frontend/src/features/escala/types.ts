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

/** `habilitado` = o backend tem credenciais da Google configuradas neste ambiente (independente de
 * quem está logado); `conectado` = o usuário atual já autorizou a própria conta. */
export interface EstadoGoogle {
  habilitado: boolean
  conectado: boolean
}

/** Pedido do usuário: "quero adicionar de alguma forma integrada ao Google Meet/Calendar... onde o
 * usuário do sistema (independente) vai conseguir marcar e entrar nas reuniões do meet... deixar
 * disponível para entrar na reunião com quem ele quer dos funcionários" - qualquer usuário cria,
 * com um ou mais participantes, dentro do expediente efetivo de cada um deles (ver
 * `ReuniaoService#criar` no backend). `linkMeet` só existe depois que a Google confirma a criação
 * do evento - é ela quem gera o link. */
export interface Reuniao {
  id: number
  criadorId: number
  criadorNome: string
  participantes: { id: number; nome: string }[]
  /** "AAAA-MM-DD". */
  data: string
  horaInicio: string
  horaFim: string
  titulo: string
  linkMeet: string | null
}

export interface CriarReuniaoInput {
  participantesIds: number[]
  data: string
  horaInicio: string
  horaFim: string
  titulo: string
}

/** Pedido do usuário: "Não consegui marcar a reunião!!" - antes não tinha jeito de saber, ao
 * escolher data/participantes no `MarcarReuniaoComMeetModal`, se a pessoa convidada de fato
 * trabalha naquele dia/horário (o backend só recusa depois, com um 400 sem detalhe - convenção do
 * projeto). `GET /escala/disponibilidade` devolve isso por pessoa pra mostrar antes de enviar. */
export interface Disponibilidade {
  usuarioId: number
  nome: string
  trabalha: boolean
  horaInicio: string | null
  horaFim: string | null
}
