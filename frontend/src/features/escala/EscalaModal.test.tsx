import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EscalaModal } from './EscalaModal'

describe('EscalaModal', () => {
  it('clicar no fundo (fora do cartão) fecha o modal', () => {
    const aoFechar = vi.fn()
    const { container } = render(
      <EscalaModal titulo="Teste" aoFechar={aoFechar}>
        <p>Conteúdo do formulário</p>
      </EscalaModal>,
    )

    fireEvent.click(container.querySelector('.escala-excecao-modal-fundo')!)

    expect(aoFechar).toHaveBeenCalled()
  })

  it('clicar dentro do cartão não fecha o modal', () => {
    const aoFechar = vi.fn()
    render(
      <EscalaModal titulo="Teste" aoFechar={aoFechar}>
        <p>Conteúdo do formulário</p>
      </EscalaModal>,
    )

    fireEvent.click(screen.getByText('Conteúdo do formulário'))

    expect(aoFechar).not.toHaveBeenCalled()
  })

  it('usa o título como aria-label do diálogo', () => {
    render(
      <EscalaModal titulo="Padrão semanal" aoFechar={vi.fn()}>
        <p>Conteúdo</p>
      </EscalaModal>,
    )

    expect(screen.getByRole('dialog', { name: 'Padrão semanal' })).toBeInTheDocument()
  })
})
