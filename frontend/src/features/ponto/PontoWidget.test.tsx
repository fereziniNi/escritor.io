import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { PontoWidget } from './PontoWidget'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
  useAuthStore.getState().definirSessao('token-fake', 'COLABORADOR')
})

function renderPontoWidget() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PontoWidget />
    </QueryClientProvider>,
  )
}

describe('PontoWidget', () => {
  it('quem nunca marcou vê só a opção de iniciar trabalho', async () => {
    server.use(
      http.get('/ponto/estado-atual', () =>
        HttpResponse.json({ ultimoTipo: null, proximasOpcoes: ['ENTRADA'] }),
      ),
    )

    renderPontoWidget()

    expect(await screen.findByRole('button', { name: 'Iniciar trabalho' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Saída' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Iniciar pausa' })).not.toBeInTheDocument()
  })

  it('quem já iniciou o trabalho não vê nenhum botão - saída e pausa saíram do card (pedido do usuário)', async () => {
    server.use(
      http.get('/ponto/estado-atual', () =>
        HttpResponse.json({ ultimoTipo: 'ENTRADA', proximasOpcoes: ['PAUSA_INICIO', 'SAIDA'] }),
      ),
    )

    renderPontoWidget()

    expect(await screen.findByText('✅ Trabalho já iniciado hoje.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('quem está em pausa também não vê nenhum botão de retomar', async () => {
    server.use(
      http.get('/ponto/estado-atual', () =>
        HttpResponse.json({ ultimoTipo: 'PAUSA_INICIO', proximasOpcoes: ['PAUSA_FIM'] }),
      ),
    )

    renderPontoWidget()

    expect(await screen.findByText('✅ Trabalho já iniciado hoje.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Retomar' })).not.toBeInTheDocument()
  })

  it('clicar em iniciar trabalho marca a entrada e o card vira só a confirmação', async () => {
    let ultimoTipo: string | null = null
    server.use(
      http.get('/ponto/estado-atual', () =>
        HttpResponse.json({
          ultimoTipo,
          proximasOpcoes: ultimoTipo === null ? ['ENTRADA'] : ['PAUSA_INICIO', 'SAIDA'],
        }),
      ),
      http.post('/ponto/marcar', async ({ request }) => {
        const corpo = (await request.json()) as { tipo: string }
        ultimoTipo = corpo.tipo
        return HttpResponse.json(
          { id: 1, tipo: corpo.tipo, momento: '2026-01-15T12:00:00Z', origem: 'WEB' },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderPontoWidget()

    await user.click(await screen.findByRole('button', { name: 'Iniciar trabalho' }))

    expect(await screen.findByText('✅ Trabalho já iniciado hoje.')).toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
