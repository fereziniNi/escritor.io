import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { formatarDataBr } from '../../shared/formatarData'
import { buscarEscalaEfetiva, listarExcecoesDaEscala, removerExcecaoDaEscala, salvarExcecaoDaEscala } from './api'
import { construirGradeDoMes } from './construirGradeDoMes'
import type { SalvarExcecaoInput } from './types'
import './Escala.css'

const MESES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const DIAS_DA_SEMANA_ABREVIADOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function horaCurta(hora: string | null): string {
  return hora ? hora.slice(0, 5) : ''
}

/**
 * Grid mensal de exceções pontuais - pedido do usuário: "poder mudar também o dia e hora" (ex.:
 * folga num dia que normalmente trabalharia, ou um horário diferente só numa data). Clicar num dia
 * do mês atual abre um formulário inline pra essa data; dias de outro mês (preenchimento da grade)
 * não são clicáveis - navegue com as setas pra editar uma data de outro mês.
 */
export function CalendarioExcecoes() {
  const hoje = new Date()
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1) // 1-12
  const [diaSelecionado, setDiaSelecionado] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const grade = construirGradeDoMes(ano, mes)
  const diasDoMes = grade.filter((dia) => dia.noMesAtual)
  const inicio = diasDoMes[0].data
  const fim = diasDoMes.at(-1)!.data

  const efetivaQuery = useQuery({
    queryKey: ['escala', 'efetiva', inicio, fim],
    queryFn: () => buscarEscalaEfetiva(inicio, fim),
  })
  const excecoesQuery = useQuery({
    queryKey: ['escala', 'excecoes', inicio, fim],
    queryFn: () => listarExcecoesDaEscala(inicio, fim),
  })

  function invalidarConsultas() {
    queryClient.invalidateQueries({ queryKey: ['escala', 'efetiva'] })
    queryClient.invalidateQueries({ queryKey: ['escala', 'excecoes'] })
  }

  const salvarMutation = useMutation({
    mutationFn: (dados: SalvarExcecaoInput) => salvarExcecaoDaEscala(dados),
    onSuccess: () => {
      invalidarConsultas()
      setDiaSelecionado(null)
    },
  })
  const removerMutation = useMutation({
    mutationFn: (id: number) => removerExcecaoDaEscala(id),
    onSuccess: () => {
      invalidarConsultas()
      setDiaSelecionado(null)
    },
  })

  function irParaMesAnterior() {
    setDiaSelecionado(null)
    if (mes === 1) {
      setAno(ano - 1)
      setMes(12)
    } else {
      setMes(mes - 1)
    }
  }

  function irParaProximoMes() {
    setDiaSelecionado(null)
    if (mes === 12) {
      setAno(ano + 1)
      setMes(1)
    } else {
      setMes(mes + 1)
    }
  }

  const efetivoPorData = new Map((efetivaQuery.data ?? []).map((dia) => [dia.data, dia]))
  const excecaoSelecionada = excecoesQuery.data?.find((excecao) => excecao.data === diaSelecionado) ?? null
  const efetivoSelecionado = diaSelecionado ? efetivoPorData.get(diaSelecionado) : undefined

  return (
    <section className="secao cartao">
      <h2 className="secao-titulo">🗓️ Exceções pontuais</h2>
      <p className="mensagem-vazia">Clique num dia pra mudar o horário só daquela data, ou marcar como folga.</p>

      <div className="escala-calendario-cabecalho">
        <button type="button" className="botao-secundario" aria-label="Mês anterior" onClick={irParaMesAnterior}>
          ←
        </button>
        <strong>
          {MESES[mes - 1]} de {ano}
        </strong>
        <button type="button" className="botao-secundario" aria-label="Próximo mês" onClick={irParaProximoMes}>
          →
        </button>
      </div>

      {(efetivaQuery.isPending || excecoesQuery.isPending) && <p className="mensagem-carregando">Carregando…</p>}
      {(efetivaQuery.isError || excecoesQuery.isError) && (
        <p className="mensagem-erro">Não foi possível carregar o calendário.</p>
      )}

      {efetivaQuery.data && excecoesQuery.data && (
        <>
          <div className="escala-calendario-grade">
            {DIAS_DA_SEMANA_ABREVIADOS.map((rotulo) => (
              <div key={rotulo} className="escala-calendario-dia-semana">
                {rotulo}
              </div>
            ))}
            {grade.map((dia) => {
              const efetivo = efetivoPorData.get(dia.data)
              const classes = ['escala-calendario-dia']
              if (!dia.noMesAtual) classes.push('escala-calendario-dia--fora-do-mes')
              if (dia.data === diaSelecionado) classes.push('escala-calendario-dia--selecionado')
              if (efetivo?.trabalha) classes.push('escala-calendario-dia--trabalha')

              return (
                <button
                  key={dia.data}
                  type="button"
                  className={classes.join(' ')}
                  disabled={!dia.noMesAtual}
                  aria-label={formatarDataBr(dia.data)}
                  onClick={() => setDiaSelecionado(dia.data === diaSelecionado ? null : dia.data)}
                >
                  <span className="escala-calendario-dia-numero" aria-hidden="true">
                    {dia.dia}
                  </span>
                  {dia.noMesAtual && efetivo?.trabalha && (
                    <span className="escala-calendario-dia-horario">
                      {horaCurta(efetivo.horaInicio)}–{horaCurta(efetivo.horaFim)}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {diaSelecionado && efetivoSelecionado && (
            <FormularioExcecaoDoDia
              data={diaSelecionado}
              trabalhaInicial={efetivoSelecionado.trabalha}
              horaInicioInicial={efetivoSelecionado.horaInicio}
              horaFimInicial={efetivoSelecionado.horaFim}
              excecaoExistenteId={excecaoSelecionada?.id ?? null}
              salvando={salvarMutation.isPending}
              removendo={removerMutation.isPending}
              erro={salvarMutation.isError || removerMutation.isError}
              aoSalvar={(dados) => salvarMutation.mutate(dados)}
              aoRemover={(id) => removerMutation.mutate(id)}
              aoFechar={() => setDiaSelecionado(null)}
            />
          )}
        </>
      )}
    </section>
  )
}

function FormularioExcecaoDoDia({
  data,
  trabalhaInicial,
  horaInicioInicial,
  horaFimInicial,
  excecaoExistenteId,
  salvando,
  removendo,
  erro,
  aoSalvar,
  aoRemover,
  aoFechar,
}: {
  data: string
  trabalhaInicial: boolean
  horaInicioInicial: string | null
  horaFimInicial: string | null
  excecaoExistenteId: number | null
  salvando: boolean
  removendo: boolean
  erro: boolean
  aoSalvar: (dados: SalvarExcecaoInput) => void
  aoRemover: (id: number) => void
  aoFechar: () => void
}) {
  const [trabalha, setTrabalha] = useState(trabalhaInicial)
  const [horaInicio, setHoraInicio] = useState(horaCurta(horaInicioInicial) || '09:00')
  const [horaFim, setHoraFim] = useState(horaCurta(horaFimInicial) || '18:00')
  const [observacao, setObservacao] = useState('')

  const [ano, mesIndex, dia] = data.split('-')

  return (
    <form
      className="escala-calendario-formulario formulario"
      onSubmit={(evento) => {
        evento.preventDefault()
        aoSalvar({
          data,
          trabalha,
          horaInicio: trabalha ? `${horaInicio}:00` : null,
          horaFim: trabalha ? `${horaFim}:00` : null,
          observacao: observacao.trim() || null,
        })
      }}
    >
      <h3 className="secao-titulo">
        {dia}/{mesIndex}/{ano}
      </h3>

      <div className="campo">
        <label>
          <input type="checkbox" checked={trabalha} onChange={(evento) => setTrabalha(evento.target.checked)} />
          Trabalho nesse dia
        </label>
      </div>

      {trabalha && (
        <div className="escala-calendario-formulario-horario">
          <div className="campo">
            <label htmlFor="excecao-hora-inicio">Início</label>
            <input
              id="excecao-hora-inicio"
              type="time"
              value={horaInicio}
              onChange={(evento) => setHoraInicio(evento.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="excecao-hora-fim">Fim</label>
            <input id="excecao-hora-fim" type="time" value={horaFim} onChange={(evento) => setHoraFim(evento.target.value)} />
          </div>
        </div>
      )}

      <div className="campo">
        <label htmlFor="excecao-observacao">Observação (opcional)</label>
        <input
          id="excecao-observacao"
          value={observacao}
          onChange={(evento) => setObservacao(evento.target.value)}
          maxLength={200}
          placeholder="Ex.: plantão, feriado, folga combinada..."
        />
      </div>

      <div className="linha-botoes">
        <button type="submit" disabled={salvando}>
          💾 Salvar
        </button>
        {excecaoExistenteId !== null && (
          <button
            type="button"
            className="botao-secundario"
            disabled={removendo}
            onClick={() => aoRemover(excecaoExistenteId)}
          >
            Remover exceção
          </button>
        )}
        <button type="button" className="botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
      {erro && <p className="mensagem-erro">Não foi possível salvar a exceção.</p>}
    </form>
  )
}
