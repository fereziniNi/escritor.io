import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { EspelhoMesPainel } from './EspelhoMesPainel'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
  useAuthStore.getState().definirSessao('token-fake', 'COLABORADOR')
})

function renderPainel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EspelhoMesPainel />
    </QueryClientProvider>,
  )
}

describe('EspelhoMesPainel', () => {
  it('lista os dias do mês com saldo e o total acumulado', async () => {
    server.use(
      http.get('/ponto/espelho-do-mes', () =>
        HttpResponse.json({
          dias: [
            { data: '2026-01-12', estado: 'FECHADA', minutosTrabalhados: 540, saldoDia: 60 },
            { data: '2026-01-13', estado: 'FECHADA', minutosTrabalhados: 480, saldoDia: 0 },
          ],
          saldoAcumuladoNoPeriodo: 60,
        }),
      ),
    )

    renderPainel()

    expect(await screen.findByText('2026-01-12')).toBeInTheDocument()
    expect(screen.getByText('2026-01-13')).toBeInTheDocument()
    expect(screen.getByText('Saldo acumulado no período: +1h00')).toBeInTheDocument()
  })

  it('mês sem nenhum dia mostra mensagem vazia', async () => {
    server.use(
      http.get('/ponto/espelho-do-mes', () => HttpResponse.json({ dias: [], saldoAcumuladoNoPeriodo: 0 })),
    )

    renderPainel()

    expect(await screen.findByText(/nenhuma marcação neste mês/i)).toBeInTheDocument()
  })
})
