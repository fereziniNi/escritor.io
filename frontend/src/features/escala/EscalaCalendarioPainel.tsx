import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { formatarDataBr } from '../../shared/formatarData'
import { buscarEscalaEfetiva, listarExcecoesDaEscala, removerExcecaoDaEscala, salvarExcecaoDaEscala } from './api'
import { CalendarioDia } from './CalendarioDia'
import { CalendarioMes } from './CalendarioMes'
import { CalendarioSemana } from './CalendarioSemana'
import { construirGradeDoMes } from './construirGradeDoMes'
import { anoDaData, dataDeHoje, diaDaData, mesDaData, nomeDoDiaDaSemana, segundaFeiraDaSemana, somarDias } from './datasEscala'
import { FormularioExcecaoDoDia } from './FormularioExcecaoDoDia'
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

type Modo = 'mes' | 'semana' | 'dia'

interface Selecao {
  data: string
  horaInicioSugerida?: string
  horaFimSugerida?: string
}

function calcularIntervalo(modo: Modo, dataReferencia: string): { inicio: string; fim: string } {
  if (modo === 'dia') {
    return { inicio: dataReferencia, fim: dataReferencia }
  }
  if (modo === 'semana') {
    const segunda = segundaFeiraDaSemana(anoDaData(dataReferencia), mesDaData(dataReferencia), diaDaData(dataReferencia))
    return { inicio: segunda, fim: somarDias(segunda, 6) }
  }
  const diasDoMes = construirGradeDoMes(anoDaData(dataReferencia), mesDaData(dataReferencia)).filter((dia) => dia.noMesAtual)
  return { inicio: diasDoMes[0].data, fim: diasDoMes.at(-1)!.data }
}

function rotuloDoPeriodo(modo: Modo, dataReferencia: string, inicio: string, fim: string): string {
  if (modo === 'dia') {
    return `${nomeDoDiaDaSemana(dataReferencia)}, ${formatarDataBr(dataReferencia)}`
  }
  if (modo === 'semana') {
    return `${formatarDataBr(inicio)} a ${formatarDataBr(fim)}`
  }
  return `${MESES[mesDaData(dataReferencia) - 1]} de ${anoDaData(dataReferencia)}`
}

/**
 * Painel do calendário de escala - pedido do usuário: "algo muito parecido com o agenda do
 * google". Três visões (Mês/Semana/Dia, como o Google Agenda) sobre os mesmos dados/mutações -
 * `CalendarioMes` é a grade mensal (clique abre a exceção do dia); `CalendarioSemana`/
 * `CalendarioDia` são a grade de horário (clique ou arraste seleciona o intervalo). O estado de
 * consulta/mutação fica aqui, compartilhado pelas 3 - cada visão é só apresentação.
 */
export function EscalaCalendarioPainel() {
  const [modo, setModo] = useState<Modo>('mes')
  const [dataReferencia, setDataReferencia] = useState(dataDeHoje)
  const [selecao, setSelecao] = useState<Selecao | null>(null)
  const queryClient = useQueryClient()

  const { inicio, fim } = calcularIntervalo(modo, dataReferencia)

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
      setSelecao(null)
    },
  })
  const removerMutation = useMutation({
    mutationFn: (id: number) => removerExcecaoDaEscala(id),
    onSuccess: () => {
      invalidarConsultas()
      setSelecao(null)
    },
  })

  function mudarModo(novoModo: Modo) {
    setModo(novoModo)
    setSelecao(null)
  }

  function irParaHoje() {
    setDataReferencia(dataDeHoje())
    setSelecao(null)
  }

  function irParaAnterior() {
    setSelecao(null)
    if (modo === 'dia') {
      setDataReferencia(somarDias(dataReferencia, -1))
    } else if (modo === 'semana') {
      setDataReferencia(somarDias(dataReferencia, -7))
    } else {
      const ano = anoDaData(dataReferencia)
      const mes = mesDaData(dataReferencia)
      setDataReferencia(mes === 1 ? `${ano - 1}-12-01` : `${ano}-${String(mes - 1).padStart(2, '0')}-01`)
    }
  }

  function irParaProximo() {
    setSelecao(null)
    if (modo === 'dia') {
      setDataReferencia(somarDias(dataReferencia, 1))
    } else if (modo === 'semana') {
      setDataReferencia(somarDias(dataReferencia, 7))
    } else {
      const ano = anoDaData(dataReferencia)
      const mes = mesDaData(dataReferencia)
      setDataReferencia(mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, '0')}-01`)
    }
  }

  const efetivoPorData = new Map((efetivaQuery.data ?? []).map((dia) => [dia.data, dia]))
  const excecaoSelecionada = selecao ? (excecoesQuery.data?.find((excecao) => excecao.data === selecao.data) ?? null) : null
  const efetivoSelecionado = selecao ? efetivoPorData.get(selecao.data) : undefined

  const diasDaSemana =
    modo === 'semana'
      ? Array.from({ length: 7 }, (_, indice) => somarDias(inicio, indice))
      : modo === 'dia'
        ? [dataReferencia]
        : []

  return (
    <section className="secao cartao">
      <h2 className="secao-titulo">🗓️ Calendário</h2>
      <p className="mensagem-vazia">
        {modo === 'mes'
          ? 'Clique num dia pra mudar o horário só daquela data, ou marcar como folga.'
          : 'Clique ou arraste num horário livre pra criar uma exceção; clique num bloco já trabalhado pra editá-lo.'}
      </p>

      <div className="escala-calendario-abas" role="tablist" aria-label="Visão do calendário">
        <button type="button" className="botao-secundario" onClick={irParaHoje}>
          Hoje
        </button>
        <button type="button" className="botao-secundario" aria-label="Período anterior" onClick={irParaAnterior}>
          ←
        </button>
        <button type="button" className="botao-secundario" aria-label="Próximo período" onClick={irParaProximo}>
          →
        </button>
        <strong className="escala-calendario-periodo">{rotuloDoPeriodo(modo, dataReferencia, inicio, fim)}</strong>
        <div className="escala-calendario-abas-modo">
          {(['mes', 'semana', 'dia'] as const).map((opcao) => (
            <button
              key={opcao}
              type="button"
              role="tab"
              aria-selected={modo === opcao}
              className={`escala-calendario-aba-modo${modo === opcao ? ' escala-calendario-aba-modo--ativa' : ''}`}
              onClick={() => mudarModo(opcao)}
            >
              {opcao === 'mes' ? 'Mês' : opcao === 'semana' ? 'Semana' : 'Dia'}
            </button>
          ))}
        </div>
      </div>

      {(efetivaQuery.isPending || excecoesQuery.isPending) && <p className="mensagem-carregando">Carregando…</p>}
      {(efetivaQuery.isError || excecoesQuery.isError) && (
        <p className="mensagem-erro">Não foi possível carregar o calendário.</p>
      )}

      {efetivaQuery.data && excecoesQuery.data && (
        <>
          {modo === 'mes' && (
            <CalendarioMes
              ano={anoDaData(dataReferencia)}
              mes={mesDaData(dataReferencia)}
              efetivoPorData={efetivoPorData}
              diaSelecionado={selecao?.data ?? null}
              aoSelecionarDia={(data) => setSelecao((atual) => (atual?.data === data ? null : { data }))}
            />
          )}
          {modo === 'semana' && (
            <CalendarioSemana
              diasDaSemana={diasDaSemana}
              efetivoPorData={efetivoPorData}
              aoSelecionarIntervalo={(data, horaInicioSugerida, horaFimSugerida) =>
                setSelecao({ data, horaInicioSugerida, horaFimSugerida })
              }
            />
          )}
          {modo === 'dia' && (
            <CalendarioDia
              data={dataReferencia}
              efetivoPorData={efetivoPorData}
              aoSelecionarIntervalo={(data, horaInicioSugerida, horaFimSugerida) =>
                setSelecao({ data, horaInicioSugerida, horaFimSugerida })
              }
            />
          )}

          {selecao && (
            <FormularioExcecaoDoDia
              data={selecao.data}
              trabalhaInicial={selecao.horaInicioSugerida ? true : (efetivoSelecionado?.trabalha ?? false)}
              horaInicioInicial={efetivoSelecionado?.horaInicio ?? null}
              horaFimInicial={efetivoSelecionado?.horaFim ?? null}
              horaInicioSugerida={selecao.horaInicioSugerida}
              horaFimSugerida={selecao.horaFimSugerida}
              observacaoInicial={excecaoSelecionada?.observacao}
              excecaoExistenteId={excecaoSelecionada?.id ?? null}
              salvando={salvarMutation.isPending}
              removendo={removerMutation.isPending}
              erro={salvarMutation.isError || removerMutation.isError}
              aoSalvar={(dados) => salvarMutation.mutate(dados)}
              aoRemover={(id) => removerMutation.mutate(id)}
              aoFechar={() => setSelecao(null)}
            />
          )}
        </>
      )}
    </section>
  )
}
