import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { QuadrosPage } from './QuadrosPage'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

function renderQuadrosPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <QuadrosPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('QuadrosPage', () => {
  describe('como colaborador', () => {
    beforeEach(() => {
      useAuthStore.setState(ESTADO_INICIAL, true)
      useAuthStore.getState().definirSessao('token-fake', 'COLABORADOR')
    })

    it('lista os quadros visíveis retornados pela API', async () => {
      server.use(
        http.get('/quadros', () =>
          HttpResponse.json([{ id: 1, nome: 'Backlog', projetoId: null, equipeId: 10, arquivado: false }]),
        ),
      )

      renderQuadrosPage()

      expect(await screen.findByText('Backlog')).toBeInTheDocument()
    })

    it('não mostra o formulário de criar quadro', async () => {
      server.use(http.get('/quadros', () => HttpResponse.json([])));

      renderQuadrosPage()

      await screen.findByText(/nenhum quadro/i)
      expect(screen.queryByRole('button', { name: /criar quadro/i })).not.toBeInTheDocument()
    })
  })

  describe('como gestor', () => {
    beforeEach(() => {
      useAuthStore.setState(ESTADO_INICIAL, true)
      useAuthStore.getState().definirSessao('token-fake', 'GESTOR')
    })

    it('cria um quadro e atualiza a lista', async () => {
      let quadrosCriados: Array<{ id: number; nome: string; projetoId: number | null; equipeId: number | null; arquivado: boolean }> = []
      server.use(
        http.get('/quadros', () => HttpResponse.json(quadrosCriados)),
        http.post('/quadros', async ({ request }) => {
          const corpo = (await request.json()) as { nome: string; equipeId: number | null }
          const novo = { id: 1, nome: corpo.nome, projetoId: null, equipeId: corpo.equipeId, arquivado: false }
          quadrosCriados = [novo]
          return HttpResponse.json(novo, { status: 201 })
        }),
      )
      const user = userEvent.setup()
      renderQuadrosPage()

      await user.type(screen.getByLabelText(/nome/i), 'Backlog')
      await user.type(screen.getByLabelText(/equipe/i), '10')
      await user.click(screen.getByRole('button', { name: /criar quadro/i }))

      expect(await screen.findByText('Backlog')).toBeInTheDocument()
    })
  })
})
