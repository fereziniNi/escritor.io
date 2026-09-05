import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CalendarioDia } from './CalendarioDia'

describe('CalendarioDia', () => {
  it('mostra a abreviação do dia da semana real, não sempre "Seg" (bug pego na verificação visual)', () => {
    // 2026-09-05 é um sábado - `CalendarioDia` reusa `CalendarioSemana` com um array de 1 dia só,
    // então calcular a abreviação pela posição no array (sempre índice 0) sempre dava "Seg".
    render(<CalendarioDia data="2026-09-05" efetivoPorData={new Map()} aoSelecionarIntervalo={vi.fn()} />)

    // `text-transform: uppercase` no CSS só afeta o render visual, não o texto do nó - o teste
    // compara contra o texto de verdade ("Sáb"), como `getByText` sempre faz.
    expect(screen.getByText('Sáb')).toBeInTheDocument()
    expect(screen.queryByText('Seg')).not.toBeInTheDocument()
  })
})
