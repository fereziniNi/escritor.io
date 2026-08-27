import { useQuery } from '@tanstack/react-query'
import { buscarJornadaDoDia } from './api'
import { formatarEstado, formatarMinutos, formatarSaldo } from './formatarMinutos'

export function JornadaPainel() {
  const jornadaQuery = useQuery({ queryKey: ['ponto', 'jornada-do-dia'], queryFn: buscarJornadaDoDia })

  if (jornadaQuery.isPending) {
    return <p>Carregando…</p>
  }

  if (jornadaQuery.isError) {
    return <p>Não foi possível carregar a jornada do dia.</p>
  }

  const jornada = jornadaQuery.data

  return (
    <section>
      <p>Estado do dia: {formatarEstado(jornada.estado)}</p>
      <p>Trabalhado hoje: {formatarMinutos(jornada.minutosTrabalhados)}</p>
      <p>Saldo do dia: {formatarSaldo(jornada.saldoDia)}</p>
      <p>Saldo acumulado no período: {formatarSaldo(jornada.saldoAcumuladoNoPeriodo)}</p>
    </section>
  )
}
