import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { ProjetosPage } from './ProjetosPage'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
  useAuthStore.getState().definirSessao('token-fake', 'ADMIN')
})

function renderProjetosPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ProjetosPage />
    </QueryClientProvider>,
  )
}

describe('ProjetosPage', () => {
  it('lista os projetos existentes', async () => {
    server.use(
      http.get('/projetos', () =>
        HttpResponse.json([
          { id: 1, nome: 'Portal', cliente: 'Acme', status: 'ATIVO', inicio: '2026-01-01', fimPrevisto: null },
        ]),
      ),
      http.get('/equipes', () => HttpResponse.json([])),
    )

    renderProjetosPage()

    expect(await screen.findByText(/portal/i)).toBeInTheDocument()
    expect(screen.getByText(/acme/i)).toBeInTheDocument()
  })

  it('cria um projeto e atualiza a lista', async () => {
    let projetosCriados: Array<{
      id: number
      nome: string
      cliente: string
      status: string
      inicio: string
      fimPrevisto: string | null
    }> = []
    server.use(
      http.get('/projetos', () => HttpResponse.json(projetosCriados)),
      http.get('/equipes', () => HttpResponse.json([])),
      http.post('/projetos', async ({ request }) => {
        const corpo = (await request.json()) as { nome: string; cliente: string; status: string; inicio: string }
        const novo = { id: 1, ...corpo, fimPrevisto: null }
        projetosCriados = [novo]
        return HttpResponse.json(novo, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderProjetosPage()

    await user.type(screen.getByLabelText(/^nome$/i), 'Portal')
    await user.type(screen.getByLabelText(/cliente/i), 'Acme')
    await user.type(screen.getByLabelText(/início/i), '2026-01-01')
    await user.click(screen.getByRole('button', { name: /criar projeto/i }))

    expect(await screen.findByText(/portal/i)).toBeInTheDocument()
  })
})
