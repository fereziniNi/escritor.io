import { CalendarioSemana } from './CalendarioSemana'
import type { DiaEfetivo, Reuniao } from './types'

/**
 * Visão de Dia - a mesma grade de horário de `CalendarioSemana`, só que com um dia só na lista de
 * colunas (o componente já é genérico o bastante pra isso, sem precisar duplicar a grade/o
 * arraste). Fica mais espaçoso que a visão de semana pro mesmo bloco trabalhado.
 */
export function CalendarioDia({
  data,
  efetivoPorData,
  reunioesPorData,
  aoSelecionarIntervalo,
  aoSelecionarReuniao,
}: {
  data: string
  efetivoPorData: Map<string, DiaEfetivo>
  reunioesPorData?: Map<string, Reuniao[]>
  aoSelecionarIntervalo: (data: string, horaInicio: string, horaFim: string) => void
  aoSelecionarReuniao?: (reuniao: Reuniao) => void
}) {
  return (
    <CalendarioSemana
      diasDaSemana={[data]}
      efetivoPorData={efetivoPorData}
      reunioesPorData={reunioesPorData}
      aoSelecionarIntervalo={aoSelecionarIntervalo}
      aoSelecionarReuniao={aoSelecionarReuniao}
    />
  )
}
