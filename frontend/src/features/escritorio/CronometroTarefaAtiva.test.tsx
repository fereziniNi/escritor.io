import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { CronometroTarefaAtiva } from './CronometroTarefaAtiva'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderComponente(aoClicar = vi.fn()) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <CronometroTarefaAtiva aoClicar={aoClicar} />
    </QueryClientProvider>,
  )
  return { aoClicar, queryClient }
}

describe('CronometroTarefaAtiva', () => {
  it('não mostra nada quando não há cronômetro ativo (204)', async () => {
    server.use(http.get('/cronometro/ativo', () => new HttpResponse(null, { status: 204 })))

    const { queryClient } = renderComponente()

    await waitFor(() => expect(queryClient.getQueryState(['cronometro-ativo'])?.status).toBe('success'))
    expect(screen.queryByRole('timer')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('mostra o título da tarefa e o relógio ao vivo quando há um cronômetro ativo', async () => {
    server.use(
      http.get('/cronometro/ativo', () =>
        HttpResponse.json({
          cardId: 7,
          cardTitulo: 'Corrigir bug do cronômetro',
          projetoId: 3,
          iniciadoEm: new Date(Date.now() - 5000).toISOString(),
          totalMinutosFechados: 0,
        }),
      ),
    )

    renderComponente()

    expect(await screen.findByText('Corrigir bug do cronômetro')).toBeInTheDocument()
    expect(screen.getByRole('timer')).toHaveTextContent(/00:00:0\d/)
  })

  it('chama aoClicar com os dados do cronômetro ativo ao clicar', async () => {
    const cronometro = {
      cardId: 7,
      cardTitulo: 'Corrigir bug do cronômetro',
      projetoId: 3,
      iniciadoEm: new Date().toISOString(),
      totalMinutosFechados: 12,
    }
    server.use(http.get('/cronometro/ativo', () => HttpResponse.json(cronometro)))
    const { aoClicar } = renderComponente()
    const user = userEvent.setup()

    await user.click(await screen.findByRole('button'))

    expect(aoClicar).toHaveBeenCalledWith(cronometro)
  })
})
