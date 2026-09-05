import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CalendarioSemana } from './CalendarioSemana'
import type { DiaEfetivo } from './types'

const DIAS = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13']

/** 32 slots de 30min = altura total do grid; cada slot mede 10px pra fazer a matemática dos
 * testes ser simples de calcular na mão (clientY = slot * 10). */
function mockarAlturaDaColuna(elemento: HTMLElement) {
  vi.spyOn(elemento, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    height: 320,
    bottom: 320,
    left: 0,
    right: 100,
    width: 100,
    x: 0,
    y: 0,
    toJSON: () => {},
  })
}

describe('CalendarioSemana', () => {
  it('mostra o dia de hoje destacado e o horário do bloco trabalhado', () => {
    const efetivoPorData = new Map<string, DiaEfetivo>([
      ['2026-09-07', { data: '2026-09-07', trabalha: true, horaInicio: '09:00:00', horaFim: '18:00:00' }],
    ])

    render(<CalendarioSemana diasDaSemana={DIAS} efetivoPorData={efetivoPorData} aoSelecionarIntervalo={vi.fn()} />)

    expect(screen.getByText('09:00–18:00')).toBeInTheDocument()
  })

  it('clicar (sem arrastar) numa área vazia sugere 1h de duração a partir do slot clicado', () => {
    const aoSelecionarIntervalo = vi.fn()
    render(<CalendarioSemana diasDaSemana={DIAS} efetivoPorData={new Map()} aoSelecionarIntervalo={aoSelecionarIntervalo} />)

    const coluna = screen.getByLabelText(/09\/09\/2026, sem trabalho/i)
    mockarAlturaDaColuna(coluna)
    // slot 8 = 08:00 (06:00 + 8*30min = 10h -> na verdade slot*30min a partir de 06:00: slot 8 = 10:00)
    fireEvent.pointerDown(coluna, { clientY: 80 })
    fireEvent.pointerUp(coluna, { clientY: 80 })

    expect(aoSelecionarIntervalo).toHaveBeenCalledWith('2026-09-09', '10:00', '11:00')
  })

  it('arrastar seleciona o intervalo exato entre o início e o fim do arraste', () => {
    const aoSelecionarIntervalo = vi.fn()
    render(<CalendarioSemana diasDaSemana={DIAS} efetivoPorData={new Map()} aoSelecionarIntervalo={aoSelecionarIntervalo} />)

    const coluna = screen.getByLabelText(/10\/09\/2026, sem trabalho/i)
    mockarAlturaDaColuna(coluna)
    fireEvent.pointerDown(coluna, { clientY: 40 }) // slot 4 = 08:00
    fireEvent.pointerMove(coluna, { clientY: 120 }) // slot 12 = 12:00
    fireEvent.pointerUp(coluna, { clientY: 120 })

    expect(aoSelecionarIntervalo).toHaveBeenCalledWith('2026-09-10', '08:00', '12:00')
  })

  it('clicar no bloco já trabalhado chama com o horário existente, sem iniciar um novo arraste', () => {
    const aoSelecionarIntervalo = vi.fn()
    const efetivoPorData = new Map<string, DiaEfetivo>([
      ['2026-09-07', { data: '2026-09-07', trabalha: true, horaInicio: '09:00:00', horaFim: '18:00:00' }],
    ])
    render(<CalendarioSemana diasDaSemana={DIAS} efetivoPorData={efetivoPorData} aoSelecionarIntervalo={aoSelecionarIntervalo} />)

    fireEvent.click(screen.getByText('09:00–18:00'))

    expect(aoSelecionarIntervalo).toHaveBeenCalledWith('2026-09-07', '09:00', '18:00')
  })

  it('soltar o botão em cima do rótulo de hora (fora da coluna) ainda finaliza o arraste, via bubbling no grid', () => {
    const aoSelecionarIntervalo = vi.fn()
    const { container } = render(
      <CalendarioSemana diasDaSemana={DIAS} efetivoPorData={new Map()} aoSelecionarIntervalo={aoSelecionarIntervalo} />,
    )

    const coluna = screen.getByLabelText(/07\/09\/2026, sem trabalho/i)
    mockarAlturaDaColuna(coluna)
    fireEvent.pointerDown(coluna, { clientY: 40 })
    // dispara pointerup num elemento qualquer dentro do grid (não na coluna) - o listener fica no
    // container externo, então funciona por bubbling mesmo soltando fora da coluna de origem
    const grade = container.querySelector('.escala-grade-horas')!
    fireEvent.pointerUp(grade)

    expect(aoSelecionarIntervalo).toHaveBeenCalledWith('2026-09-07', '08:00', '09:00')
  })
})
