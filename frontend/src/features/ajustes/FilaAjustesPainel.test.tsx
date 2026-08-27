import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { FilaAjustesPainel } from './FilaAjustesPainel'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
  useAuthStore.getState().definirSessao('token-fake', 'GESTOR')
})

const SOLICITACAO_PENDENTE = {
  id: 1,
  usuarioId: 7,
  usuarioNome: 'Ana Souza',
  tipoSolicitado: 'ENTRADA',
  momentoSolicitado: '2026-01-15T09:00:00Z',
  registroAlvoId: null,
  justificativa: 'Esqueci de bater o ponto',
  status: 'PENDENTE',
  criadoEm: '2026-01-15T10:00:00Z',
}

function renderPainel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <FilaAjustesPainel />
    </QueryClientProvider>,
  )
}

describe('FilaAjustesPainel', () => {
  it('lista as solicitações pendentes', async () => {
    server.use(http.get('/ajustes/pendentes', () => HttpResponse.json([SOLICITACAO_PENDENTE])))

    renderPainel()

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByText('Esqueci de bater o ponto')).toBeInTheDocument()
  })

  it('sem solicitações pendentes mostra mensagem vazia', async () => {
    server.use(http.get('/ajustes/pendentes', () => HttpResponse.json([])))

    renderPainel()

    expect(await screen.findByText(/nenhuma solicitação pendente/i)).toBeInTheDocument()
  })

  it('aprova uma solicitação e ela some da fila', async () => {
    let pendentes = [SOLICITACAO_PENDENTE]
    server.use(
      http.get('/ajustes/pendentes', () => HttpResponse.json(pendentes)),
      http.post('/ajustes/1/aprovar', () => {
        pendentes = []
        return HttpResponse.json({ ...SOLICITACAO_PENDENTE, status: 'APROVADA' });
      }),
    )
    const user = userEvent.setup()
    renderPainel()

    await user.click(await screen.findByRole('button', { name: /aprovar/i }))

    expect(await screen.findByText(/nenhuma solicitação pendente/i)).toBeInTheDocument()
  })

  it('rejeitar sem preencher parecer mostra erro e mantém a solicitação na fila', async () => {
    server.use(
      http.get('/ajustes/pendentes', () => HttpResponse.json([SOLICITACAO_PENDENTE])),
      http.post('/ajustes/1/rejeitar', () => HttpResponse.json(null, { status: 400 })),
    )
    const user = userEvent.setup()
    renderPainel()

    await user.click(await screen.findByRole('button', { name: /rejeitar/i }));

    expect(await screen.findByText(/não foi possível rejeitar/i)).toBeInTheDocument()
    expect(screen.getByText('Ana Souza')).toBeInTheDocument()
  })

  it('rejeitar com parecer preenchido remove a solicitação da fila', async () => {
    let pendentes = [SOLICITACAO_PENDENTE]
    server.use(
      http.get('/ajustes/pendentes', () => HttpResponse.json(pendentes)),
      http.post('/ajustes/1/rejeitar', async ({ request }) => {
        const corpo = (await request.json()) as { parecer: string }
        if (!corpo.parecer || !corpo.parecer.trim()) {
          return HttpResponse.json(null, { status: 400 })
        }
        pendentes = []
        return HttpResponse.json({ ...SOLICITACAO_PENDENTE, status: 'REJEITADA' })
      }),
    )
    const user = userEvent.setup()
    renderPainel()

    await user.type(await screen.findByLabelText(/parecer/i), 'Sem evidência do horário alegado')
    await user.click(screen.getByRole('button', { name: /rejeitar/i }))

    expect(await screen.findByText(/nenhuma solicitação pendente/i)).toBeInTheDocument()
  })
})
