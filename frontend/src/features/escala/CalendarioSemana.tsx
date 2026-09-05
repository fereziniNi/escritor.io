import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { formatarDataBr } from '../../shared/formatarData'
import { abreviacaoDoDiaDaSemana, dataDeHoje, diaDaData } from './datasEscala'
import { HORAS_DO_ROTULO, HORA_FIM_GRADE, HORA_INICIO_GRADE, TOTAL_SLOTS, horaParaSlot, slotParaHora } from './gradeDeHoras'
import type { DiaEfetivo } from './types'

function horaCurta(hora: string | null): string {
  return hora ? hora.slice(0, 5) : ''
}

function pctDoSlot(slot: number): number {
  return (slot / TOTAL_SLOTS) * 100
}

function slotDoPonteiro(elemento: HTMLElement, clientY: number): number {
  const rect = elemento.getBoundingClientRect()
  const fracao = (clientY - rect.top) / rect.height
  return Math.min(Math.max(Math.round(fracao * TOTAL_SLOTS), 0), TOTAL_SLOTS)
}

/**
 * Grade de horário estilo Google Agenda (06:00-22:00, faixa fixa que cobre qualquer expediente
 * razoável sem precisar de scroll numa grade de 24h) - usada tanto pela visão de Semana quanto,
 * com uma coluna só, pela visão de Dia (`CalendarioDia.tsx`). Clicar numa área vazia cria uma
 * exceção de 1h a partir do slot clicado; arrastar seleciona o intervalo exato; clicar no bloco já
 * trabalhado abre o formulário pra editá-lo.
 */
export function CalendarioSemana({
  diasDaSemana,
  efetivoPorData,
  aoSelecionarIntervalo,
}: {
  diasDaSemana: string[]
  efetivoPorData: Map<string, DiaEfetivo>
  aoSelecionarIntervalo: (data: string, horaInicio: string, horaFim: string) => void
}) {
  const hoje = dataDeHoje()
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const minutosAgora = agora.getHours() * 60 + agora.getMinutes()
  const pctAgora = ((minutosAgora - HORA_INICIO_GRADE * 60) / ((HORA_FIM_GRADE - HORA_INICIO_GRADE) * 60)) * 100

  const [arrastando, setArrastando] = useState<{ data: string; inicioSlot: number; fimSlot: number } | null>(null)

  function iniciarArraste(data: string, evento: ReactPointerEvent<HTMLDivElement>) {
    const slot = slotDoPonteiro(evento.currentTarget, evento.clientY)
    setArrastando({ data, inicioSlot: slot, fimSlot: slot })
  }

  function atualizarArraste(data: string, evento: ReactPointerEvent<HTMLDivElement>) {
    // calcula o slot já aqui (síncrono, com o evento ainda válido) em vez de dentro do updater de
    // `setArrastando` - `evento.currentTarget` não é confiável depois que o handler retorna.
    const slot = slotDoPonteiro(evento.currentTarget, evento.clientY)
    setArrastando((atual) => {
      if (!atual || atual.data !== data) {
        return atual
      }
      return { ...atual, fimSlot: slot }
    })
  }

  function finalizarArraste() {
    setArrastando((atual) => {
      if (!atual) {
        return null
      }
      const inicio = Math.min(atual.inicioSlot, atual.fimSlot)
      // clique sem arrastar (início === fim) vira 1h de duração padrão, não um evento de 0min
      const fim = atual.inicioSlot === atual.fimSlot ? Math.min(inicio + 2, TOTAL_SLOTS) : Math.max(atual.inicioSlot, atual.fimSlot)
      aoSelecionarIntervalo(atual.data, slotParaHora(inicio), slotParaHora(fim))
      return null
    })
  }

  return (
    <div
      className="escala-grade-horas"
      style={{
        gridTemplateColumns: `3.5rem repeat(${diasDaSemana.length}, 1fr)`,
        gridTemplateRows: `auto repeat(${TOTAL_SLOTS}, 1.4rem)`,
      }}
      onPointerUp={finalizarArraste}
    >
      <div className="escala-grade-horas-canto" style={{ gridColumn: 1, gridRow: 1 }} />
      {diasDaSemana.map((data, indice) => (
        <div key={data} className="escala-grade-horas-cabecalho-dia" style={{ gridColumn: indice + 2, gridRow: 1 }}>
          <span className="escala-grade-horas-cabecalho-abrev">{abreviacaoDoDiaDaSemana(data)}</span>
          <span className={`escala-grade-horas-cabecalho-numero${data === hoje ? ' escala-grade-horas-cabecalho-numero--hoje' : ''}`}>
            {diaDaData(data)}
          </span>
        </div>
      ))}

      {HORAS_DO_ROTULO.map((hora, indice) => (
        <div
          key={hora}
          className="escala-grade-horas-rotulo"
          style={{ gridColumn: 1, gridRow: `${indice * 2 + 2} / span 2` }}
        >
          {hora === HORA_FIM_GRADE ? '' : `${String(hora).padStart(2, '0')}:00`}
        </div>
      ))}

      {diasDaSemana.map((data, indice) => {
        const efetivo = efetivoPorData.get(data)
        const arrasteDeste = arrastando?.data === data ? arrastando : null

        return (
          <div
            key={data}
            className="escala-grade-dia-coluna"
            style={{ gridColumn: indice + 2, gridRow: `2 / span ${TOTAL_SLOTS}` }}
            aria-label={`${formatarDataBr(data)}${efetivo?.trabalha ? `, trabalha ${horaCurta(efetivo.horaInicio)} às ${horaCurta(efetivo.horaFim)}` : ', sem trabalho'}`}
            onPointerDown={(evento) => iniciarArraste(data, evento)}
            onPointerMove={(evento) => atualizarArraste(data, evento)}
          >
            {data === hoje && pctAgora >= 0 && pctAgora <= 100 && (
              <div className="escala-linha-agora" style={{ top: `${pctAgora}%` }} />
            )}

            {arrasteDeste && (
              <div
                className="escala-bloco-arraste"
                style={{
                  top: `${pctDoSlot(Math.min(arrasteDeste.inicioSlot, arrasteDeste.fimSlot))}%`,
                  height: `${pctDoSlot(Math.max(arrasteDeste.inicioSlot, arrasteDeste.fimSlot) - Math.min(arrasteDeste.inicioSlot, arrasteDeste.fimSlot))}%`,
                }}
              />
            )}

            {efetivo?.trabalha && efetivo.horaInicio && efetivo.horaFim && (
              <button
                type="button"
                className="escala-bloco-trabalho"
                style={{
                  top: `${pctDoSlot(horaParaSlot(efetivo.horaInicio))}%`,
                  height: `${pctDoSlot(horaParaSlot(efetivo.horaFim) - horaParaSlot(efetivo.horaInicio))}%`,
                }}
                onPointerDown={(evento) => evento.stopPropagation()}
                onClick={() => aoSelecionarIntervalo(data, horaCurta(efetivo.horaInicio), horaCurta(efetivo.horaFim))}
              >
                {horaCurta(efetivo.horaInicio)}–{horaCurta(efetivo.horaFim)}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
