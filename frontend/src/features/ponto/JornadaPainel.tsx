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
      <p>Total apontado hoje: {formatarMinutos(jornada.totalApontadoMinutos)}</p>
      {/* Só informativo (S4.9) - marcar SAIDA (PontoWidget, componente separado) continua
      liberado independente desse valor, ponto e apontamento são sistemas paralelos (PRD §3.4). */}
      <p>Diferença apontado vs. trabalhado: {formatarSaldo(jornada.totalApontadoMinutos - jornada.minutosTrabalhados)}</p>
    </section>
  )
}
