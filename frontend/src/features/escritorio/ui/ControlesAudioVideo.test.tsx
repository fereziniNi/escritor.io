import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ControlesAudioVideo } from './ControlesAudioVideo'

describe('ControlesAudioVideo', () => {
  it('pedido do usuário: "voice... Implemente da melhor maneira possível" - mic desligado mostra 🔇 e chama aoAlternarMic ao clicar', async () => {
    const aoAlternarMic = vi.fn()
    const user = userEvent.setup()
    render(<ControlesAudioVideo micAtivo={false} aoAlternarMic={aoAlternarMic} />)

    const botao = screen.getByRole('button', { name: /ativar microfone/i })
    expect(botao).toHaveTextContent('🔇')
    expect(botao).toHaveAttribute('aria-pressed', 'false')

    await user.click(botao)
    expect(aoAlternarMic).toHaveBeenCalledTimes(1)
  })

  it('mic ativado mostra 🎤 e aria-pressed true', () => {
    render(<ControlesAudioVideo micAtivo={true} aoAlternarMic={vi.fn()} />)

    const botao = screen.getByRole('button', { name: /desativar microfone/i })
    expect(botao).toHaveTextContent('🎤')
    expect(botao).toHaveAttribute('aria-pressed', 'true')
  })

  it('pedido do usuário: "Deixe so o microfone e tire os outros dois do lado dele" - câmera e compartilhar tela não existem mais aqui', () => {
    render(<ControlesAudioVideo micAtivo={false} aoAlternarMic={vi.fn()} />)

    expect(screen.queryByTitle(/câmera/i)).not.toBeInTheDocument()
    expect(screen.queryByTitle(/compartilhar tela/i)).not.toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})
