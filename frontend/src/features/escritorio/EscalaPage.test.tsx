import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { EscalaPage } from './EscalaPage'

const server = setupServer(
  http.get('/escala/semanal', () => HttpResponse.json([])),
  http.get('/escala/efetiva', () => HttpResponse.json([])),
  http.get('/escala/excecoes', () => HttpResponse.json([])),
  http.get('/escala/equipe', () => HttpResponse.json([])),
  http.get('/integracoes/google/estado', () => HttpResponse.json({ habilitado: false, conectado: false })),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

function renderPagina() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EscalaPage />
    </QueryClientProvider>,
  )
}

describe('EscalaPage', () => {
  afterEach(() => useAuthStore.setState(ESTADO_INICIAL, true))

  it('colaborador não vê a escala da equipe, só a própria', async () => {
    useAuthStore.setState(ESTADO_INICIAL, true)
    useAuthStore.getState().definirSessao('token-fake', 'COLABORADOR')

    renderPagina()

    expect(await screen.findByRole('heading', { name: /padrão semanal/i })).toBeInTheDocument()
    expect(await screen.findByText(/🗓️ Calendário/i)).toBeInTheDocument()
    expect(screen.queryByText(/escala da equipe/i)).not.toBeInTheDocument()
  })

  it('gestor também vê a escala da equipe', async () => {
    useAuthStore.setState(ESTADO_INICIAL, true)
    useAuthStore.getState().definirSessao('token-fake', 'GESTOR')

    renderPagina()

    expect(await screen.findByText(/escala da equipe/i)).toBeInTheDocument()
  })

  it('admin também vê a escala da equipe', async () => {
    useAuthStore.setState(ESTADO_INICIAL, true)
    useAuthStore.getState().definirSessao('token-fake', 'ADMIN')

    renderPagina()

    expect(await screen.findByText(/escala da equipe/i)).toBeInTheDocument()
  })
})
