import { useQuery } from '@tanstack/react-query'
import { buscarEspelhoDoMes } from './api'
import { formatarEstado, formatarMinutos, formatarSaldo } from './formatarMinutos'

export function EspelhoMesPainel() {
  const espelhoQuery = useQuery({ queryKey: ['ponto', 'espelho-do-mes'], queryFn: () => buscarEspelhoDoMes() })

  if (espelhoQuery.isPending) {
    return <p>Carregando…</p>
  }

  if (espelhoQuery.isError) {
    return <p>Não foi possível carregar o espelho do mês.</p>
  }

  const espelho = espelhoQuery.data

  return (
    <section>
      <h2>Espelho do mês</h2>
      {espelho.dias.length === 0 && <p>Nenhuma marcação neste mês.</p>}
      <table>
        <tbody>
          {espelho.dias.map((dia) => (
            <tr key={dia.data}>
              <td>{dia.data}</td>
              <td>{formatarEstado(dia.estado)}</td>
              <td>{formatarMinutos(dia.minutosTrabalhados)}</td>
              <td>{formatarSaldo(dia.saldoDia)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Saldo acumulado no período: {formatarSaldo(espelho.saldoAcumuladoNoPeriodo)}</p>
    </section>
  )
}
