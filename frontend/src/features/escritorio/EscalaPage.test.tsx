import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { EscalaPage } from './EscalaPage'

const server = setupServer(
  http.get('/escala/semanal', () => HttpResponse.json([])),
  http.get('/escala/efetiva', () => HttpResponse.json([])),
  http.get('/escala/excecoes', () => HttpResponse.json([])),
  http.get('/escala/reunioes', () => HttpResponse.json([])),
  http.get('/integracoes/google/estado', () => HttpResponse.json({ habilitado: false, conectado: false })),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderPagina() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EscalaPage aoEntrarNaReuniao={() => {}} />
    </QueryClientProvider>,
  )
}

describe('EscalaPage', () => {
  // Pedido do usuário: "Queria que o calendario pessoal de horarios ficasse em uma parte e para
  // agendar as reunioes em outra opcao do sistema" - este painel agora é só sobre a própria
  // escala (qualquer papel usa da mesma forma); a "Escala da equipe"/marcar reunião mudou pra
  // `ReunioesPage` (ver `ReunioesPage.test.tsx`).
  it('mostra o padrão semanal e o calendário pessoal, sem nada da equipe', async () => {
    renderPagina()

    expect(await screen.findByRole('heading', { name: /padrão semanal/i })).toBeInTheDocument()
    expect(await screen.findByText(/🗓️ Calendário/i)).toBeInTheDocument()
    expect(screen.queryByText(/escala da equipe/i)).not.toBeInTheDocument()
  })
})
