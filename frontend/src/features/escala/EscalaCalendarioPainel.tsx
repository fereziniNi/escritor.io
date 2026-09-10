import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { decodeJwt } from '../auth/jwt'
import { useAuthStore } from '../auth/authStore'
import { formatarDataBr } from '../../shared/formatarData'
import {
  buscarEscalaEfetiva,
  listarExcecoesDaEscala,
  listarMinhasReunioes,
  removerExcecaoDaEscala,
  removerReuniao,
  salvarExcecaoDaEscala,
} from './api'
import { CalendarioDia } from './CalendarioDia'
import { CalendarioMes } from './CalendarioMes'
import { CalendarioSemana } from './CalendarioSemana'
import { construirGradeDoMes } from './construirGradeDoMes'
import { anoDaData, dataDeHoje, diaDaData, mesDaData, nomeDoDiaDaSemana, segundaFeiraDaSemana, somarDias } from './datasEscala'
import { EscalaModal } from './EscalaModal'
import { FormularioExcecaoDoDia } from './FormularioExcecaoDoDia'
import type { Reuniao, SalvarExcecaoInput } from './types'
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
 * `CalendarioMes` é a grade mensal (clique num dia troca pra visão de Dia, mostrando a agenda
 * completa daquela data - pedido do usuário: "abrir a agenda dela do dia e ver todos os horarios
 * dela disponivel, incluindo o que ela deixou salvo no padrão semanal"); `CalendarioSemana`/
 * `CalendarioDia` são a grade de horário, onde o horário efetivo (padrão semanal + exceção
 * mesclados) aparece como um bloco, e clique/arraste num horário livre cria/edita uma exceção. O
 * estado de consulta/mutação fica aqui, compartilhado pelas 3 - cada visão é só apresentação.
 */
export function EscalaCalendarioPainel({ aoEntrarNaReuniao }: { aoEntrarNaReuniao: () => void }) {
  const [modo, setModo] = useState<Modo>('mes')
  const [dataReferencia, setDataReferencia] = useState(dataDeHoje)
  const [selecao, setSelecao] = useState<Selecao | null>(null)
  const [reuniaoSelecionada, setReuniaoSelecionada] = useState<Reuniao | null>(null)
  const accessToken = useAuthStore((estado) => estado.accessToken)
  const meuUsuarioId = accessToken ? Number(decodeJwt(accessToken).sub) : null
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
  // Pedido do usuário: reunião marcada "fica registrada e aparece... pro funcionário" - traz
  // reuniões onde a pessoa é criadora OU convidada (qualquer uma marca agora, não só o chefe).
  const reunioesQuery = useQuery({
    queryKey: ['escala', 'reunioes', inicio, fim],
    queryFn: () => listarMinhasReunioes(inicio, fim),
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
  const cancelarReuniaoMutation = useMutation({
    mutationFn: (id: number) => removerReuniao(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escala', 'reunioes'] })
      setReuniaoSelecionada(null)
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

  const reunioesPorData = new Map<string, Reuniao[]>()
  for (const reuniao of reunioesQuery.data ?? []) {
    reunioesPorData.set(reuniao.data, [...(reunioesPorData.get(reuniao.data) ?? []), reuniao])
  }

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
          ? 'Clique num dia pra ver a agenda completa dele, com os horários do padrão semanal e as exceções.'
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
              diaSelecionado={dataReferencia}
              aoSelecionarDia={(data) => {
                // pedido do usuário: "caso a pessoa clica no dia deve abrir a agenda dela do dia e
                // ver todos os horarios dela disponivel, incluindo o que ela deixou salvo no
                // padrão semanal" - clicar num dia do mês leva pra visão de Dia (a agenda
                // completa daquele dia), não direto pro formulário de exceção. `CalendarioDia` já
                // mostra o horário efetivo (padrão semanal + exceção mesclados, ver
                // `EscalaService#calcularEfetiva`) como um bloco na grade - editar continua sendo
                // clicar/arrastar nela, mesmo mecanismo das visões Semana/Dia.
                setDataReferencia(data)
                setModo('dia')
              }}
            />
          )}
          {modo === 'semana' && (
            <CalendarioSemana
              diasDaSemana={diasDaSemana}
              efetivoPorData={efetivoPorData}
              reunioesPorData={reunioesPorData}
              aoSelecionarIntervalo={(data, horaInicioSugerida, horaFimSugerida) =>
                setSelecao({ data, horaInicioSugerida, horaFimSugerida })
              }
              aoSelecionarReuniao={setReuniaoSelecionada}
            />
          )}
          {modo === 'dia' && (
            <CalendarioDia
              data={dataReferencia}
              efetivoPorData={efetivoPorData}
              reunioesPorData={reunioesPorData}
              aoSelecionarIntervalo={(data, horaInicioSugerida, horaFimSugerida) =>
                setSelecao({ data, horaInicioSugerida, horaFimSugerida })
              }
              aoSelecionarReuniao={setReuniaoSelecionada}
            />
          )}

          {selecao && (
            <EscalaModal titulo={`Horário de ${formatarDataBr(selecao.data)}`} aoFechar={() => setSelecao(null)}>
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
            </EscalaModal>
          )}

          {reuniaoSelecionada && (
            // Pedido do usuário: "quero adicionar de alguma forma integrada ao Google Meet...
            // disponibilizar o link caso queira compartilhar" - "Entrar no Meet"/"Copiar link" são
            // a videochamada de verdade; "Entrar na reunião" continua sendo o teleporte pro
            // escritório virtual (pedido anterior: "onde está o link da reunião para eu entrar?
            // Preciso entrar no google?" -> a Sala de Reunião do mapa, sem link nenhum) - as duas
            // convivem, não são a mesma coisa. Cancelar só aparece pra quem criou.
            <EscalaModal titulo="Reunião" aoFechar={() => setReuniaoSelecionada(null)}>
              <div className="escala-reuniao-detalhe">
                <p className="escala-reuniao-detalhe-titulo">{reuniaoSelecionada.titulo}</p>
                <p>
                  {formatarDataBr(reuniaoSelecionada.data)}, {reuniaoSelecionada.horaInicio.slice(0, 5)}–
                  {reuniaoSelecionada.horaFim.slice(0, 5)}
                </p>
                <p className="mensagem-vazia">
                  Marcada por {reuniaoSelecionada.criadorNome} · com{' '}
                  {reuniaoSelecionada.participantes.map((participante) => participante.nome).join(', ')}
                </p>
                {reuniaoSelecionada.linkMeet && (
                  <div className="campo">
                    <label htmlFor="reuniao-detalhe-link">Link do Meet</label>
                    <input id="reuniao-detalhe-link" value={reuniaoSelecionada.linkMeet} readOnly />
                  </div>
                )}
                <div className="linha-botoes">
                  {reuniaoSelecionada.linkMeet && (
                    <>
                      <a className="botao-secundario" href={reuniaoSelecionada.linkMeet} target="_blank" rel="noreferrer">
                        🎥 Entrar no Meet
                      </a>
                      <button
                        type="button"
                        className="botao-secundario"
                        onClick={() => navigator.clipboard?.writeText(reuniaoSelecionada.linkMeet ?? '')}
                      >
                        🔗 Copiar link
                      </button>
                    </>
                  )}
                  <button type="button" className="botao-secundario" onClick={aoEntrarNaReuniao}>
                    🗣️ Entrar na sala do escritório
                  </button>
                  {reuniaoSelecionada.criadorId === meuUsuarioId && (
                    <button
                      type="button"
                      className="botao-secundario"
                      disabled={cancelarReuniaoMutation.isPending}
                      onClick={() => cancelarReuniaoMutation.mutate(reuniaoSelecionada.id)}
                    >
                      Cancelar reunião
                    </button>
                  )}
                </div>
                {cancelarReuniaoMutation.isError && <p className="mensagem-erro">Não foi possível cancelar a reunião.</p>}
              </div>
            </EscalaModal>
          )}
        </>
      )}
    </section>
  )
}
