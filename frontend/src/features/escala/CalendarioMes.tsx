import { formatarDataBr } from '../../shared/formatarData'
import { construirGradeDoMes } from './construirGradeDoMes'
import { dataDeHoje } from './datasEscala'
import type { DiaEfetivo } from './types'

const DIAS_DA_SEMANA_ABREVIADOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function horaCurta(hora: string | null): string {
  return hora ? hora.slice(0, 5) : ''
}

/**
 * Grid mensal - estilo Google Agenda: número do dia de hoje num círculo preenchido, horário
 * trabalhado como um "chip" arredondado em vez de texto solto. Clicar num dia do mês atual chama
 * `aoSelecionarDia` (o painel pai troca pra visão de Dia daquela data - pedido do usuário: "abrir
 * a agenda dela do dia"); dias de outro mês (preenchimento da grade) não são clicáveis - navegue
 * com as setas do painel pai pra ver um dia de outro mês.
 */
export function CalendarioMes({
  ano,
  mes,
  efetivoPorData,
  diaSelecionado,
  aoSelecionarDia,
}: {
  ano: number
  mes: number
  efetivoPorData: Map<string, DiaEfetivo>
  diaSelecionado: string | null
  aoSelecionarDia: (data: string) => void
}) {
  const hoje = dataDeHoje()
  const grade = construirGradeDoMes(ano, mes)

  return (
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
            onClick={() => aoSelecionarDia(dia.data)}
          >
            <span
              className={`escala-calendario-dia-numero${dia.data === hoje ? ' escala-calendario-dia-numero--hoje' : ''}`}
              aria-hidden="true"
            >
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
  )
}
