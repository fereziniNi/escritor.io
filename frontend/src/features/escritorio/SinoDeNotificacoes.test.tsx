import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SinoDeNotificacoes } from './SinoDeNotificacoes'

/**
 * Pedido do usuário: "Tem como tirar o botão de notificação do menu e deixar na parte superior???
 * Mas eu não quero que fique o botão! Inove" - `BarraFerramentas.test.tsx` não existe (o dock é
 * exercitado via `EscritorioPage.test.tsx`); este componente saiu de lá e ganhou testes próprios.
 */
describe('SinoDeNotificacoes', () => {
  it('sem não lidas, fica no estado quieto (sem contador) e continua clicável', async () => {
    const usuario = userEvent.setup()
    const aoClicar = vi.fn()
    render(<SinoDeNotificacoes naoLidas={0} aberto={false} aoClicar={aoClicar} />)

    const sino = screen.getByRole('button', { name: 'Notificações' })
    expect(sino).not.toHaveClass('escritorio-sino--tocando')
    expect(sino.querySelector('.escritorio-sino-contador')).toBeNull()

    // histórico continua acessível a qualquer momento, mesmo sem nada novo.
    await usuario.click(sino)
    expect(aoClicar).toHaveBeenCalledTimes(1)
  })

  it('com não lidas, "toca": ganha a classe de destaque e mostra o contador', () => {
    render(<SinoDeNotificacoes naoLidas={3} aberto={false} aoClicar={vi.fn()} />)

    const sino = screen.getByRole('button', { name: 'Notificações, 3 não lidas' })
    expect(sino).toHaveClass('escritorio-sino--tocando')
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('acima de 9 não lidas, mostra "9+" no contador visível (mas o aria-label continua com o número real)', () => {
    render(<SinoDeNotificacoes naoLidas={15} aberto={false} aoClicar={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Notificações, 15 não lidas' })).toBeInTheDocument()
    expect(screen.getByText('9+')).toBeInTheDocument()
  })

  it('reflete o painel aberto com uma classe própria', () => {
    render(<SinoDeNotificacoes naoLidas={0} aberto={true} aoClicar={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Notificações' })).toHaveClass('escritorio-sino--aberto')
  })
})
