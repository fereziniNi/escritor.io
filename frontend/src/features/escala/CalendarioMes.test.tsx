import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { formatarDataBr } from '../../shared/formatarData'
import { CalendarioMes } from './CalendarioMes'
import { construirGradeDoMes } from './construirGradeDoMes'
import { anoDaData, dataDeHoje, mesDaData } from './datasEscala'
import type { DiaEfetivo } from './types'

// Sem fake timers de propósito (mesma lição de `CalendarioExcecoes.test.tsx` original: trava
// `findBy`/`user-event`) - usa o mês/ano real de hoje pra testar o destaque de "hoje".
const HOJE = dataDeHoje()
const ANO_ATUAL = anoDaData(HOJE)
const MES_ATUAL = mesDaData(HOJE)

describe('CalendarioMes', () => {
  it('mostra o horário efetivo de um dia trabalhado', () => {
    const dia = `${ANO_ATUAL}-${String(MES_ATUAL).padStart(2, '0')}-05`
    const efetivoPorData = new Map<string, DiaEfetivo>([
      [dia, { data: dia, trabalha: true, horaInicio: '09:00:00', horaFim: '18:00:00' }],
    ])

    render(
      <CalendarioMes
        ano={ANO_ATUAL}
        mes={MES_ATUAL}
        efetivoPorData={efetivoPorData}
        diaSelecionado={null}
        aoSelecionarDia={vi.fn()}
      />,
    )

    expect(screen.getByText('09:00–18:00')).toBeInTheDocument()
  })

  it('destaca o dia de hoje', () => {
    render(
      <CalendarioMes ano={ANO_ATUAL} mes={MES_ATUAL} efetivoPorData={new Map()} diaSelecionado={null} aoSelecionarDia={vi.fn()} />,
    )

    const botaoHoje = screen.getByRole('button', { name: formatarDataBr(HOJE) })
    const numero = botaoHoje.querySelector('.escala-calendario-dia-numero')
    expect(numero).toHaveClass('escala-calendario-dia-numero--hoje')
  })

  it('clicar num dia do mês chama aoSelecionarDia com a data', async () => {
    const aoSelecionarDia = vi.fn()
    const user = userEvent.setup()
    const dia = `${ANO_ATUAL}-${String(MES_ATUAL).padStart(2, '0')}-01`
    render(
      <CalendarioMes
        ano={ANO_ATUAL}
        mes={MES_ATUAL}
        efetivoPorData={new Map()}
        diaSelecionado={null}
        aoSelecionarDia={aoSelecionarDia}
      />,
    )

    await user.click(screen.getByRole('button', { name: formatarDataBr(dia) }))

    expect(aoSelecionarDia).toHaveBeenCalledWith(dia)
  })

  it('desabilita os dias de preenchimento de outro mês', () => {
    const primeiroDiaForaDoMes = construirGradeDoMes(ANO_ATUAL, MES_ATUAL).find((dia) => !dia.noMesAtual)
    if (!primeiroDiaForaDoMes) {
      return // mês raro sem nenhum preenchimento - nada a verificar
    }
    render(
      <CalendarioMes ano={ANO_ATUAL} mes={MES_ATUAL} efetivoPorData={new Map()} diaSelecionado={null} aoSelecionarDia={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: formatarDataBr(primeiroDiaForaDoMes.data) })).toBeDisabled()
  })
})
