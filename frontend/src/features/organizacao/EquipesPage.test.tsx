import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { EquipesPage } from './EquipesPage'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
  useAuthStore.getState().definirSessao('token-fake', 'ADMIN')
})

function renderEquipesPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EquipesPage />
    </QueryClientProvider>,
  )
}

describe('EquipesPage', () => {
  it('lista as equipes existentes', async () => {
    server.use(
      http.get('/equipes', () =>
        HttpResponse.json([{ id: 1, nome: 'Backend', descricao: null, ativa: true }]),
      ),
    )

    renderEquipesPage()

    expect(await screen.findByText('Backend')).toBeInTheDocument()
  })

  it('cria uma equipe e atualiza a lista', async () => {
    let equipesCriadas: Array<{ id: number; nome: string; descricao: string | null; ativa: boolean }> = []
    server.use(
      http.get('/equipes', () => HttpResponse.json(equipesCriadas)),
      http.post('/equipes', async ({ request }) => {
        const corpo = (await request.json()) as { nome: string; descricao: string | null }
        const nova = { id: 1, nome: corpo.nome, descricao: corpo.descricao, ativa: true }
        equipesCriadas = [nova]
        return HttpResponse.json(nova, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderEquipesPage()

    await user.type(screen.getByLabelText(/nome/i), 'Backend')
    await user.click(screen.getByRole('button', { name: /criar equipe/i }))

    expect(await screen.findByText('Backend')).toBeInTheDocument()
  })
})
