import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { dispararDownload } from '../../shared/dispararDownload'
import { formatarMesAno } from '../ponto/formatarMarcacao'
import { formatarMinutos, formatarSaldo } from '../ponto/formatarMinutos'
import { baixarFechamentoMesXlsx, buscarFechamentoMes } from './api'
import './relatorios.css'

/** Mês corrente em UTC (AAAA-MM), como o backend. */
function mesCorrente(): string {
  return new Date().toISOString().slice(0, 7)
}

function inicialDoNome(nome: string): string {
  return nome.trim().charAt(0).toUpperCase()
}

/** Contagem de dias que pede atenção (sem marcação, inconsistente): laranja quando > 0, "—" apagado quando 0. */
function Contagem({ valor, rotulo }: { valor: number; rotulo: string }) {
  if (valor === 0) {
    return <span className="fechamento-contagem-zero" aria-label={`0 ${rotulo}`}>—</span>
  }
  return <span className="fechamento-contagem-alerta">{valor}</span>
}

/**
 * Pedido do usuário: "o admin conseguisse exportar um relatório do mês que ele quiser e ver as
 * horas de cada pessoa naquele mês, com um saldo total de horas sobrando ou faltando de cada
 * pessoa" - e depois: "deixe a tabela bonita, bem apresentável, agradável de se ver" (resumo em
 * cartões, saldo em etiqueta verde/vermelha, exportação em Excel formatado). Só aparece pra ADMIN
 * (`RelatoriosPage`); o backend também barra os demais papéis.
 */
export function FechamentoMesPainel() {
  const [mes, setMes] = useState(mesCorrente)

  const fechamentoQuery = useQuery({
    queryKey: ['relatorios', 'fechamento-mensal', mes],
    queryFn: () => buscarFechamentoMes(mes),
    enabled: mes !== '',
    placeholderData: keepPreviousData,
  })

  const exportarMutation = useMutation({
    mutationFn: () => baixarFechamentoMesXlsx(mes),
    onSuccess: (blob) => dispararDownload(blob, `fechamento-${mes}.xlsx`),
  })

  const pessoas = fechamentoQuery.data?.pessoas ?? []
  const saldoTotal = pessoas.reduce((soma, pessoa) => soma + pessoa.saldoMinutos, 0)
  const horasTotal = pessoas.reduce((soma, pessoa) => soma + pessoa.minutosTrabalhados, 0)
  const diasTrabalhadosTotal = pessoas.reduce((soma, pessoa) => soma + pessoa.diasTrabalhados, 0)
  const semMarcacaoTotal = pessoas.reduce((soma, pessoa) => soma + pessoa.diasUteisSemMarcacao, 0)
  const inconsistentesTotal = pessoas.reduce((soma, pessoa) => soma + pessoa.diasInconsistentes, 0)
  const pessoasDevendo = pessoas.filter((pessoa) => pessoa.saldoMinutos < 0).length

  return (
    <section className="secao cartao">
      <div className="fechamento-cabecalho">
        <h2 className="secao-titulo">🗂️ Fechamento do mês</h2>
        <div className="fechamento-acoes">
          <div className="campo">
            <label htmlFor="mes-fechamento">Mês do fechamento</label>
            <input
              id="mes-fechamento"
              type="month"
              value={mes}
              max={mesCorrente()}
              onChange={(evento) => setMes(evento.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={() => exportarMutation.mutate()}
            disabled={mes === '' || exportarMutation.isPending}
          >
            {exportarMutation.isPending ? 'Gerando…' : '⬇️ Exportar Excel'}
          </button>
        </div>
      </div>
      {exportarMutation.isError && <p className="mensagem-erro">Não foi possível exportar o fechamento do mês.</p>}

      {fechamentoQuery.isPending && mes !== '' && <p className="mensagem-carregando">Carregando…</p>}
      {fechamentoQuery.isError && <p className="mensagem-erro">Não foi possível carregar o fechamento do mês.</p>}

      {fechamentoQuery.data && (
        <>
          <p className="fechamento-subtitulo">
            Horas de cada pessoa em <strong>{formatarMesAno(fechamentoQuery.data.mes)}</strong>
          </p>

          {pessoas.length === 0 && <p className="mensagem-vazia">Nenhuma pessoa ativa.</p>}
          {pessoas.length > 0 && (
            <>
              <div className="grade-stats">
                <div className="stat-cartao">
                  <div className="stat-cartao-rotulo">Pessoas</div>
                  <div className="stat-cartao-valor">{pessoas.length}</div>
                </div>
                <div className="stat-cartao">
                  <div className="stat-cartao-rotulo">Horas da equipe</div>
                  <div className="stat-cartao-valor">{formatarMinutos(horasTotal)}</div>
                </div>
                <div className="stat-cartao">
                  <div className="stat-cartao-rotulo">Saldo da equipe</div>
                  <div className={`stat-cartao-valor ${saldoTotal < 0 ? 'stat-negativo' : 'stat-positivo'}`}>
                    {formatarSaldo(saldoTotal)}
                  </div>
                </div>
                <div className="stat-cartao">
                  <div className="stat-cartao-rotulo">Com saldo negativo</div>
                  <div className={`stat-cartao-valor ${pessoasDevendo > 0 ? 'stat-negativo' : 'stat-positivo'}`}>
                    {pessoasDevendo} {pessoasDevendo === 1 ? 'pessoa' : 'pessoas'}
                  </div>
                </div>
              </div>

              <div className="fechamento-tabela-moldura">
                <table className="tabela-elegante fechamento-tabela">
                  <thead>
                    <tr>
                      <th>Pessoa</th>
                      <th className="fechamento-numero">Carga diária</th>
                      <th className="fechamento-numero">Dias trabalhados</th>
                      <th className="fechamento-numero">Horas trabalhadas</th>
                      <th className="fechamento-numero">Saldo</th>
                      <th className="fechamento-numero">Dias úteis sem marcação</th>
                      <th className="fechamento-numero">Dias inconsistentes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pessoas.map((pessoa) => (
                      <tr key={pessoa.usuarioId}>
                        <td>
                          <span className="fechamento-pessoa">
                            <span className="fechamento-avatar" aria-hidden="true">
                              {inicialDoNome(pessoa.nome)}
                            </span>
                            {pessoa.nome}
                          </span>
                        </td>
                        <td className="fechamento-numero fechamento-suave">{formatarMinutos(pessoa.cargaDiariaMinutos)}</td>
                        <td className="fechamento-numero">{pessoa.diasTrabalhados}</td>
                        <td className="fechamento-numero fechamento-destaque">{formatarMinutos(pessoa.minutosTrabalhados)}</td>
                        <td className="fechamento-numero">
                          <span className={`fechamento-saldo ${pessoa.saldoMinutos < 0 ? 'fechamento-saldo-negativo' : 'fechamento-saldo-positivo'}`}>
                            {formatarSaldo(pessoa.saldoMinutos)}
                          </span>
                        </td>
                        <td className="fechamento-numero">
                          <Contagem valor={pessoa.diasUteisSemMarcacao} rotulo="dias úteis sem marcação" />
                        </td>
                        <td className="fechamento-numero">
                          <Contagem valor={pessoa.diasInconsistentes} rotulo="dias inconsistentes" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th>Total da equipe</th>
                      <td />
                      <td className="fechamento-numero">{diasTrabalhadosTotal}</td>
                      <td className="fechamento-numero">{formatarMinutos(horasTotal)}</td>
                      <td className="fechamento-numero">
                        <span className={`fechamento-saldo ${saldoTotal < 0 ? 'fechamento-saldo-negativo' : 'fechamento-saldo-positivo'}`}>
                          {formatarSaldo(saldoTotal)}
                        </span>
                      </td>
                      <td className="fechamento-numero">{semMarcacaoTotal}</td>
                      <td className="fechamento-numero">{inconsistentesTotal}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <p className="fechamento-nota">
                Saldo = horas de cada dia útil marcado − carga diária. Dias úteis sem nenhuma marcação aparecem à parte e não
                entram no saldo.
              </p>
            </>
          )}
        </>
      )}
    </section>
  )
}
