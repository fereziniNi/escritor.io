import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { SolicitarAjusteForm } from './SolicitarAjusteForm'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
  useAuthStore.getState().definirSessao('token-fake', 'COLABORADOR')
})

function renderForm() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <SolicitarAjusteForm />
    </QueryClientProvider>,
  )
}

describe('SolicitarAjusteForm', () => {
  it('envia a solicitação e mostra confirmação', async () => {
    server.use(
      http.post('/ajustes', async ({ request }) => {
        const corpo = (await request.json()) as { tipo: string; momento: string; justificativa: string }
        return HttpResponse.json(
          {
            id: 1,
            tipoSolicitado: corpo.tipo,
            momentoSolicitado: corpo.momento,
            registroAlvoId: null,
            justificativa: corpo.justificativa,
            status: 'PENDENTE',
          },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText(/data e hora/i), '2026-01-15T09:00')
    await user.type(screen.getByLabelText(/justificativa/i), 'Esqueci de bater o ponto')
    await user.click(screen.getByRole('button', { name: /enviar solicitação/i }))

    expect(await screen.findByText(/solicitação enviada/i)).toBeInTheDocument()
  })

  it('mostra erro quando o envio falha', async () => {
    server.use(http.post('/ajustes', () => HttpResponse.json(null, { status: 400 })))
    const user = userEvent.setup()
    renderForm()

    await user.type(screen.getByLabelText(/data e hora/i), '2026-01-15T09:00')
    await user.type(screen.getByLabelText(/justificativa/i), '   ')
    await user.click(screen.getByRole('button', { name: /enviar solicitação/i }))

    expect(await screen.findByText(/não foi possível enviar/i)).toBeInTheDocument()
  })
})
