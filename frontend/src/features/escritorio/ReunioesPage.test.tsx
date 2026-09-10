import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { ReunioesPage } from './ReunioesPage'

const server = setupServer(
  http.get('/escala/equipe', () => HttpResponse.json([])),
  http.get('/escala/reunioes/equipe', () => HttpResponse.json([])),
  http.get('/usuarios/basico', () => HttpResponse.json([])),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

function renderPagina() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ReunioesPage />
    </QueryClientProvider>,
  )
}

/**
 * Pedido do usuário: "para agendar as reunioes em outra opcao do sistema" - `EscalaEquipePainel`
 * saiu de dentro de `EscalaPage` e virou esta página própria. Depois, "onde o usuário do sistema
 * (independente) vai conseguir marcar e entrar nas reuniões do meet": deixou de ser GESTOR/ADMIN
 * só - "➕ Nova reunião" é pra qualquer papel (exige Google conectado); "Escala da equipe" continua
 * um atalho só de GESTOR/ADMIN, decidido aqui dentro (a página não é mais GESTOR/ADMIN-only por
 * inteiro, então o gate migrou de `EscritorioPage`/`BarraFerramentas` pra cá).
 */
describe('ReunioesPage', () => {
  afterEach(() => useAuthStore.setState(ESTADO_INICIAL, true))

  it('sem o Google conectado, mostra o aviso pra conectar em vez do botão de marcar reunião', async () => {
    useAuthStore.setState(ESTADO_INICIAL, true)
    useAuthStore.getState().definirSessao('token-fake', 'COLABORADOR')
    server.use(http.get('/integracoes/google/estado', () => HttpResponse.json({ habilitado: true, conectado: false })))

    renderPagina()

    expect(await screen.findByText(/conecte sua conta/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /nova reunião/i })).not.toBeInTheDocument()
  })

  it('com o Google conectado, mostra o botão de marcar reunião pra qualquer papel', async () => {
    useAuthStore.setState(ESTADO_INICIAL, true)
    useAuthStore.getState().definirSessao('token-fake', 'COLABORADOR')
    server.use(http.get('/integracoes/google/estado', () => HttpResponse.json({ habilitado: true, conectado: true })))

    renderPagina()

    expect(await screen.findByRole('button', { name: /nova reunião/i })).toBeInTheDocument()
    expect(screen.queryByText(/escala da equipe/i)).not.toBeInTheDocument()
  })

  it('gestor também vê a escala da equipe', async () => {
    useAuthStore.setState(ESTADO_INICIAL, true)
    useAuthStore.getState().definirSessao('token-fake', 'GESTOR')
    server.use(http.get('/integracoes/google/estado', () => HttpResponse.json({ habilitado: true, conectado: true })))

    renderPagina()

    expect(await screen.findByText(/escala da equipe/i)).toBeInTheDocument()
  })

  it('clicar em "Nova reunião" abre o modal de marcar reunião', async () => {
    useAuthStore.setState(ESTADO_INICIAL, true)
    useAuthStore.getState().definirSessao('token-fake', 'COLABORADOR')
    server.use(http.get('/integracoes/google/estado', () => HttpResponse.json({ habilitado: true, conectado: true })))
    const user = userEvent.setup()

    renderPagina()

    await user.click(await screen.findByRole('button', { name: /nova reunião/i }))

    expect(await screen.findByRole('dialog', { name: /marcar reunião/i })).toBeInTheDocument()
  })
})
