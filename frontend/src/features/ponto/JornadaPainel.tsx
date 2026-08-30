import { useQuery } from '@tanstack/react-query'
import { buscarJornadaDoDia } from './api'
import { formatarEstado, formatarMinutos, formatarSaldo } from './formatarMinutos'

export function JornadaPainel() {
  const jornadaQuery = useQuery({ queryKey: ['ponto', 'jornada-do-dia'], queryFn: buscarJornadaDoDia })

  if (jornadaQuery.isPending) {
    return <p className="mensagem-carregando">Carregando…</p>
  }

  if (jornadaQuery.isError) {
    return <p className="mensagem-erro">Não foi possível carregar a jornada do dia.</p>
  }

  const jornada = jornadaQuery.data
  const diferenca = jornada.totalApontadoMinutos - jornada.minutosTrabalhados

  return (
    <section className="secao">
      <h3 className="secao-titulo">📅 Jornada de hoje</h3>
      <div className="grade-stats">
        <div className="stat-cartao">
          <div className="stat-cartao-rotulo">Estado do dia</div>
          <div className="stat-cartao-valor">{formatarEstado(jornada.estado)}</div>
        </div>
        <div className="stat-cartao">
          <div className="stat-cartao-rotulo">Trabalhado hoje</div>
          <div className="stat-cartao-valor">{formatarMinutos(jornada.minutosTrabalhados)}</div>
        </div>
        <div className="stat-cartao">
          <div className="stat-cartao-rotulo">Saldo do dia</div>
          <div className={`stat-cartao-valor ${jornada.saldoDia < 0 ? 'stat-negativo' : 'stat-positivo'}`}>
            {formatarSaldo(jornada.saldoDia)}
          </div>
        </div>
        <div className="stat-cartao">
          <div className="stat-cartao-rotulo">Saldo acumulado no período</div>
          <div className={`stat-cartao-valor ${jornada.saldoAcumuladoNoPeriodo < 0 ? 'stat-negativo' : 'stat-positivo'}`}>
            {formatarSaldo(jornada.saldoAcumuladoNoPeriodo)}
          </div>
        </div>
        <div className="stat-cartao">
          <div className="stat-cartao-rotulo">Total apontado hoje</div>
          <div className="stat-cartao-valor">{formatarMinutos(jornada.totalApontadoMinutos)}</div>
        </div>
        {/* Só informativo (S4.9) - marcar SAIDA (PontoWidget, componente separado) continua
        liberado independente desse valor, ponto e apontamento são sistemas paralelos (PRD §3.4). */}
        <div className="stat-cartao">
          <div className="stat-cartao-rotulo">Apontado vs. trabalhado</div>
          <div className={`stat-cartao-valor ${diferenca < 0 ? 'stat-negativo' : 'stat-positivo'}`}>
            {formatarSaldo(diferenca)}
          </div>
        </div>
      </div>
    </section>
  )
}
