import { useQuery } from '@tanstack/react-query'
import { listarTotalApontadoPorCard } from '../kanban/api'
import { buscarJornadaDoDia } from './api'
import { formatarMinutos } from './formatarMinutos'
import { calcularLimitesDoDiaUtc } from './limitesDoDiaUtc'

/**
 * Pedido do usuário: "remova o estado do dia... o total apontado... apontado vs trabalhando
 * também. Deixe somente o trabalhado hoje e quanto tempo trabalhou em cada tarefa" - saiu todo o
 * resto que existia aqui (estado do dia, saldo do dia, saldo acumulado no período, total apontado
 * agregado, apontado vs. trabalhado). No lugar do agregado, agora lista o tempo apontado
 * individualmente em cada card hoje (`listarTotalApontadoPorCard`, `agrupar=card` do backend) -
 * mais concreto que só um número somado.
 */
export function JornadaPainel() {
  const jornadaQuery = useQuery({ queryKey: ['ponto', 'jornada-do-dia'], queryFn: buscarJornadaDoDia })

  const limites = calcularLimitesDoDiaUtc(new Date())
  const porTarefaQuery = useQuery({
    queryKey: ['apontamentos', 'por-card', 'hoje'],
    queryFn: () => listarTotalApontadoPorCard(limites),
  })

  if (jornadaQuery.isPending) {
    return <p className="mensagem-carregando">Carregando…</p>
  }

  if (jornadaQuery.isError) {
    return <p className="mensagem-erro">Não foi possível carregar a jornada do dia.</p>
  }

  const jornada = jornadaQuery.data

  return (
    <section className="secao">
      <h3 className="secao-titulo">📅 Jornada de hoje</h3>
      <div className="grade-stats">
        <div className="stat-cartao">
          <div className="stat-cartao-rotulo">Trabalhado hoje</div>
          <div className="stat-cartao-valor">{formatarMinutos(jornada.minutosTrabalhados)}</div>
        </div>
      </div>

      <h4>📌 Tempo por tarefa hoje</h4>
      {porTarefaQuery.isPending && <p className="mensagem-carregando">Carregando…</p>}
      {porTarefaQuery.isError && <p className="mensagem-erro">Não foi possível carregar o tempo por tarefa.</p>}
      {porTarefaQuery.data?.length === 0 && <p className="mensagem-vazia">Nenhuma tarefa apontada hoje.</p>}
      {porTarefaQuery.data && porTarefaQuery.data.length > 0 && (
        <ul className="lista-cartoes">
          {porTarefaQuery.data.map((item) => (
            <li key={item.cardId} className="cartao-item">
              <div className="cartao-item-cabecalho">
                <span className="cartao-item-titulo">{item.cardTitulo}</span>
                <span className="badge">{formatarMinutos(item.totalMinutos)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
