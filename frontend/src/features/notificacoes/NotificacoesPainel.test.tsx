import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NotificacoesPainel } from './NotificacoesPainel'
import type { Notificacao } from './types'

function notificacao(sobrescreve: Partial<Notificacao> = {}): Notificacao {
  return {
    id: 1,
    tipo: 'NOVA_TAREFA',
    texto: 'Ana criou a tarefa "Corrigir bug" em Site novo',
    link: null,
    lida: false,
    criadoEm: new Date().toISOString(),
    ...sobrescreve,
  }
}

describe('NotificacoesPainel', () => {
  it('mostra uma mensagem vazia quando não há notificações', () => {
    render(<NotificacoesPainel itens={[]} />)
    expect(screen.getByText('Nenhuma notificação por aqui ainda.')).toBeInTheDocument()
  })

  it('lista o texto e o ícone de cada tipo de notificação', () => {
    render(
      <NotificacoesPainel
        itens={[
          notificacao({ id: 1, tipo: 'CONVITE_REUNIAO', texto: 'Ana te chamou para "Daily"' }),
          notificacao({ id: 2, tipo: 'TAREFA_CONCLUIDA', texto: 'Beto concluiu "Corrigir bug" em Site novo' }),
          notificacao({ id: 3, tipo: 'SORTEIO_HAPPY_HOUR', texto: '🎉 Roleta girou! Atividade escolhida: "Pizza"' }),
        ]}
      />,
    )
    expect(screen.getByText(/📹.*Ana te chamou para "Daily"/)).toBeInTheDocument()
    expect(screen.getByText(/✅.*Beto concluiu "Corrigir bug" em Site novo/)).toBeInTheDocument()
    expect(screen.getByText(/🎉.*Roleta girou! Atividade escolhida: "Pizza"/)).toBeInTheDocument()
  })

  it('pedido do usuário: "ver as últimas que chegaram" - mostra o tempo relativo de cada uma', () => {
    const cincoMinutosAtras = new Date(Date.now() - 5 * 60_000).toISOString()
    render(<NotificacoesPainel itens={[notificacao({ criadoEm: cincoMinutosAtras })]} />)
    expect(screen.getByText('há 5 min')).toBeInTheDocument()
  })

  it('destaca visualmente quem ainda não foi lida', () => {
    render(<NotificacoesPainel itens={[notificacao({ id: 1, lida: false })]} />)
    expect(screen.getByRole('listitem')).toHaveClass('cartao-item--nao-lida')
  })

  it('não destaca quem já foi lida', () => {
    render(<NotificacoesPainel itens={[notificacao({ id: 1, lida: true })]} />)
    expect(screen.getByRole('listitem')).not.toHaveClass('cartao-item--nao-lida')
  })

  it('só mostra o botão "Abrir" quando existe um link, e abre em uma nova aba ao clicar', async () => {
    const usuario = userEvent.setup()
    const abrirJanelaMock = vi.spyOn(window, 'open').mockImplementation(() => null)

    render(
      <NotificacoesPainel
        itens={[
          notificacao({ id: 1, link: 'https://meet.google.com/abc-defg-hij' }),
          notificacao({ id: 2, link: null }),
        ]}
      />,
    )

    const botoesAbrir = screen.getAllByRole('button', { name: 'Abrir' })
    expect(botoesAbrir).toHaveLength(1)

    await usuario.click(botoesAbrir[0])
    expect(abrirJanelaMock).toHaveBeenCalledWith('https://meet.google.com/abc-defg-hij', '_blank')

    abrirJanelaMock.mockRestore()
  })
})
