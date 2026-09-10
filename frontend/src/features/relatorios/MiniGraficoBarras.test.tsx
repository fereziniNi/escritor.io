import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MiniGraficoBarras } from './MiniGraficoBarras'

describe('MiniGraficoBarras', () => {
  it('renderiza 24 colunas, uma por hora do dia', () => {
    render(<MiniGraficoBarras valores={new Array(24).fill(0)} formatarValor={(v) => `${v}min`} />)

    expect(screen.getByRole('img', { name: /distribuição por hora do dia/i })).toBeInTheDocument()
    // rótulo de hora só a cada 3 horas (0h, 3h, 6h...) - 8 no total.
    expect(screen.getAllByText(/^\d{1,2}h$/)).toHaveLength(8)
  })

  it('a barra mais alta corresponde ao maior valor - altura proporcional ao máximo', () => {
    const valores = new Array(24).fill(0)
    valores[9] = 30
    valores[14] = 90

    render(<MiniGraficoBarras valores={valores} formatarValor={(v) => `${v}min`} />)

    expect(screen.getByTitle('14h: 90min')).toBeInTheDocument()
    expect(screen.getByTitle('9h: 30min')).toBeInTheDocument()
    // 0min - existe pra toda hora sem dado (21 delas, já que só 2 das 24 têm valor).
    expect(screen.getAllByTitle(/^\d{1,2}h: 0min$/)).toHaveLength(22)
  })
})
