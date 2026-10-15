import '../relatorios/relatorios.css'
import { formatarMinutos } from './formatarMinutos'
import type { EspelhoDia } from './types'

interface GraficoHorasPorDiaProps {
  /** Mês no formato AAAA-MM. */
  mes: string
  dias: EspelhoDia[]
}

/**
 * Uma barra por dia do mês (dia sem marcação = barra vazia) - mesmo visual CSS puro do histograma
 * de hora do dia dos Relatórios, pra enxergar de relance quais dias pesaram mais.
 */
export function GraficoHorasPorDia({ mes, dias }: GraficoHorasPorDiaProps) {
  const [ano, numeroDoMes] = mes.split('-').map(Number)
  const diasNoMes = new Date(Date.UTC(ano, numeroDoMes, 0)).getUTCDate()
  const minutosPorDia = new Array<number>(diasNoMes).fill(0)
  for (const dia of dias) {
    minutosPorDia[Number(dia.data.slice(8, 10)) - 1] = dia.minutosTrabalhados
  }
  const maximo = Math.max(1, ...minutosPorDia)

  return (
    <div className="mini-grafico-barras" role="img" aria-label="Horas trabalhadas por dia do mês">
      {minutosPorDia.map((minutos, indice) => {
        const dia = indice + 1
        return (
          <div key={dia} className="mini-grafico-barra-coluna" title={`Dia ${dia}: ${formatarMinutos(minutos)}`}>
            <div className="mini-grafico-barra" style={{ height: `${(minutos / maximo) * 100}%` }} />
            {(dia === 1 || dia % 5 === 0) && <span className="mini-grafico-barra-rotulo">{dia}</span>}
          </div>
        )
      })}
    </div>
  )
}
