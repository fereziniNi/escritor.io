import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { ProjetosPage } from './ProjetosPage'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

function renderProjetosPage(props?: { aoSelecionarProjeto?: (id: number) => void }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ProjetosPage {...props} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('ProjetosPage', () => {
  describe('como colaborador', () => {
    beforeEach(() => {
      useAuthStore.setState(ESTADO_INICIAL, true)
      useAuthStore.getState().definirSessao('token-fake', 'COLABORADOR')
    })

    it('lista os projetos visíveis retornados pela API', async () => {
      server.use(
        http.get('/projetos', () =>
          HttpResponse.json([{ id: 1, nome: 'Portal', cliente: 'Acme', status: 'ATIVO', inicio: '2026-01-01', fimPrevisto: null }]),
        ),
      )

      renderProjetosPage()

      expect(await screen.findByText('Portal')).toBeInTheDocument()
      expect(screen.getByText('Acme')).toBeInTheDocument()
    })

    it('não mostra o formulário de criar projeto', async () => {
      server.use(http.get('/projetos', () => HttpResponse.json([])))

      renderProjetosPage()

      await screen.findByText(/nenhum projeto/i)
      expect(screen.queryByRole('button', { name: /criar projeto/i })).not.toBeInTheDocument()
    })
  })

  describe('como gestor', () => {
    beforeEach(() => {
      useAuthStore.setState(ESTADO_INICIAL, true)
      useAuthStore.getState().definirSessao('token-fake', 'GESTOR')
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

      expect(await screen.findByText('Portal')).toBeInTheDocument()
    })
  })

  describe('seleção (usada pelo dock, sem navegar de verdade)', () => {
    beforeEach(() => {
      useAuthStore.setState(ESTADO_INICIAL, true)
      useAuthStore.getState().definirSessao('token-fake', 'COLABORADOR')
    })

    it('chama aoSelecionarProjeto ao clicar num projeto, em vez de navegar', async () => {
      server.use(
        http.get('/projetos', () =>
          HttpResponse.json([{ id: 1, nome: 'Portal', cliente: 'Acme', status: 'ATIVO', inicio: '2026-01-01', fimPrevisto: null }]),
        ),
      )
      const aoSelecionarProjeto = vi.fn()
      const user = userEvent.setup()
      renderProjetosPage({ aoSelecionarProjeto })

      await user.click(await screen.findByText('Portal'))

      expect(aoSelecionarProjeto).toHaveBeenCalledWith(1)
    })
  })
})
