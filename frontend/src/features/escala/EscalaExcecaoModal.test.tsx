import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EscalaExcecaoModal } from './EscalaExcecaoModal'

describe('EscalaExcecaoModal', () => {
  it('clicar no fundo (fora do cartão) fecha o modal', () => {
    const aoFechar = vi.fn()
    const { container } = render(
      <EscalaExcecaoModal aoFechar={aoFechar}>
        <p>Conteúdo do formulário</p>
      </EscalaExcecaoModal>,
    )

    fireEvent.click(container.querySelector('.escala-excecao-modal-fundo')!)

    expect(aoFechar).toHaveBeenCalled()
  })

  it('clicar dentro do cartão não fecha o modal', () => {
    const aoFechar = vi.fn()
    render(
      <EscalaExcecaoModal aoFechar={aoFechar}>
        <p>Conteúdo do formulário</p>
      </EscalaExcecaoModal>,
    )

    fireEvent.click(screen.getByText('Conteúdo do formulário'))

    expect(aoFechar).not.toHaveBeenCalled()
  })
})
