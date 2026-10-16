import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { dispararDownload } from '../../shared/dispararDownload'
import { inicioDoDiaNaEmpresa, mesAtualNaEmpresa } from '../../shared/fusoEmpresa'
import { formatarDataBr } from '../../shared/formatarData'
import { buscarEstatisticas } from '../relatorios/api'
import { periodoDoMes } from '../relatorios/estatisticasUtils'
import { baixarEspelhoDoMesCsv, buscarEspelhoDoMes, buscarMesesDisponiveis } from './api'
import { formatarMesAno } from './formatarMarcacao'
import { formatarEstado, formatarMinutos, formatarSaldo } from './formatarMinutos'
import { GraficoHorasPorDia } from './GraficoHorasPorDia'
import { calcularInsightsDoMes, nomeDoDiaDaSemana } from './insightsDoMes'

function formatarSemana(inicio: string, fim: string): string {
  return `${formatarDataBr(inicio).slice(0, 5)} a ${formatarDataBr(fim).slice(0, 5)}`
}

function CartaoInsight({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="stat-cartao">
      <div className="stat-cartao-rotulo">{rotulo}</div>
      <div className="stat-cartao-valor">{valor}</div>
      {detalhe && <div className="stat-cartao-rotulo">{detalhe}</div>}
    </div>
  )
}

/**
 * Pedido do usuário: horas auditáveis, com todos os meses (não só o corrente) e um mini dashboard
 * de insights de cada um (dia/semana que mais trabalhou, tarefas concluídas...). `mes` (AAAA-MM)
 * indefinido = mês corrente; o seletor lista os meses com marcação.
 */
export function EspelhoMesPainel() {
  const [mes, setMes] = useState<string | undefined>(undefined)
  const chaveDoMes = mes ?? 'atual'

  const mesesQuery = useQuery({ queryKey: ['ponto', 'meses-disponiveis'], queryFn: () => buscarMesesDisponiveis() })
  const espelhoQuery = useQuery({
    queryKey: ['ponto', 'espelho-do-mes', chaveDoMes],
    queryFn: () => buscarEspelhoDoMes(undefined, mes),
    // ao trocar de mês, mantém o seletor/tabela na tela até o novo mês chegar (sem piscar "Carregando")
    placeholderData: keepPreviousData,
  })
  // o mês corrente (fuso da empresa, como no backend) é sempre o primeiro da lista de meses disponíveis
  const mesEfetivo = mes ?? mesAtualNaEmpresa()
  // tarefas concluídas do mês (o espelho só tem horas) - falha aqui não derruba o resto do painel
  const tarefasQuery = useQuery({
    queryKey: ['ponto', 'insights-tarefas', mesEfetivo],
    queryFn: () => {
      const periodo = periodoDoMes(mesEfetivo)
      return buscarEstatisticas({ usuarioId: null, inicio: inicioDoDiaNaEmpresa(periodo.inicio), fim: inicioDoDiaNaEmpresa(periodo.fim) })
    },
    placeholderData: keepPreviousData,
  })

  const exportarCsvMutation = useMutation({
    mutationFn: () => baixarEspelhoDoMesCsv(undefined, mes),
    onSuccess: (blob) => dispararDownload(blob, `espelho-${mes ?? 'do-mes'}.csv`),
  })

  if (espelhoQuery.isPending) {
    return <p className="mensagem-carregando">Carregando…</p>
  }

  if (espelhoQuery.isError) {
    return <p className="mensagem-erro">Não foi possível carregar o espelho do mês.</p>
  }

  const espelho = espelhoQuery.data
  const datasDeTarefas = tarefasQuery.data?.pessoal.tarefasConcluidasDetalhe.map((tarefa) => tarefa.concluidoEm) ?? []
  const insights =
    espelho.dias.length > 0 || datasDeTarefas.length > 0 ? calcularInsightsDoMes(espelho.dias, datasDeTarefas) : null

  return (
    <section className="secao cartao">
      <h2 className="secao-titulo">🗓️ Espelho do mês</h2>
      {mesesQuery.data && (
        <div className="campo">
          <label htmlFor="mes-espelho">Mês</label>
          <select id="mes-espelho" value={mes ?? mesesQuery.data[0]} onChange={(evento) => setMes(evento.target.value)}>
            {mesesQuery.data.map((opcao) => (
              <option key={opcao} value={opcao}>
                {formatarMesAno(opcao)}
              </option>
            ))}
          </select>
        </div>
      )}
      {espelho.dias.length === 0 && <p className="mensagem-vazia">Nenhuma marcação neste mês.</p>}
      {espelho.dias.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="tabela-elegante">
            <thead>
              <tr>
                <th>Data</th>
                <th>Estado</th>
                <th>Trabalhado</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {espelho.dias.map((dia) => (
                <tr key={dia.data}>
                  <td>{formatarDataBr(dia.data)}</td>
                  <td>{formatarEstado(dia.estado)}</td>
                  <td>{formatarMinutos(dia.minutosTrabalhados)}</td>
                  <td>{formatarSaldo(dia.saldoDia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p>Saldo acumulado no período: {formatarSaldo(espelho.saldoAcumuladoNoPeriodo)}</p>
      {insights && (
        <>
          <h3>📈 Insights do mês</h3>
          <div className="grade-stats">
            <CartaoInsight rotulo="Total trabalhado" valor={formatarMinutos(insights.totalMinutos)}
              detalhe={`${insights.diasTrabalhados} dia(s) · média ${formatarMinutos(insights.mediaMinutosPorDiaTrabalhado)}/dia`} />
            <CartaoInsight rotulo="Dia que mais trabalhou"
              valor={insights.melhorDia ? formatarDataBr(insights.melhorDia.data) : '—'}
              detalhe={insights.melhorDia ? formatarMinutos(insights.melhorDia.valor) : undefined} />
            <CartaoInsight rotulo="Semana que mais trabalhou"
              valor={insights.melhorSemana ? formatarSemana(insights.melhorSemana.inicio, insights.melhorSemana.fim) : '—'}
              detalhe={insights.melhorSemana ? formatarMinutos(insights.melhorSemana.valor) : undefined} />
            <CartaoInsight rotulo="Dia da semana mais produtivo"
              valor={insights.diaDaSemanaMaisProdutivo ? nomeDoDiaDaSemana(insights.diaDaSemanaMaisProdutivo.diaDaSemana) : '—'}
              detalhe={insights.diaDaSemanaMaisProdutivo ? `média de ${formatarMinutos(insights.diaDaSemanaMaisProdutivo.mediaMinutos)}` : undefined} />
            <CartaoInsight rotulo="Tarefas concluídas" valor={String(insights.tarefasConcluidas)}
              detalhe={insights.melhorDiaTarefas ? `mais em ${formatarDataBr(insights.melhorDiaTarefas.data)} (${insights.melhorDiaTarefas.valor})` : undefined} />
            <CartaoInsight rotulo="Semana com mais tarefas"
              valor={insights.melhorSemanaTarefas ? formatarSemana(insights.melhorSemanaTarefas.inicio, insights.melhorSemanaTarefas.fim) : '—'}
              detalhe={insights.melhorSemanaTarefas ? `${insights.melhorSemanaTarefas.valor} tarefa(s)` : undefined} />
            {insights.diasInconsistentes > 0 && (
              <CartaoInsight rotulo="Dias inconsistentes" valor={String(insights.diasInconsistentes)} detalhe="falta saída no dia" />
            )}
          </div>
          <h3>Horas por dia</h3>
          <GraficoHorasPorDia mes={mesEfetivo} dias={espelho.dias} />
        </>
      )}
      <div className="linha-botoes">
        <button type="button" onClick={() => exportarCsvMutation.mutate()} disabled={exportarCsvMutation.isPending}>
          ⬇️ Exportar CSV
        </button>
      </div>
      {exportarCsvMutation.isError && <p className="mensagem-erro">Não foi possível exportar o espelho do mês.</p>}
    </section>
  )
}
