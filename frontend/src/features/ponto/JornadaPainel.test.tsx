import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { JornadaPainel } from './JornadaPainel'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
  useAuthStore.getState().definirSessao('token-fake', 'COLABORADOR')
})

function renderJornadaPainel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <JornadaPainel />
    </QueryClientProvider>,
  )
}

describe('JornadaPainel', () => {
  it('exibe saldo positivo com sinal de mais', async () => {
    server.use(
      http.get('/ponto/jornada-do-dia', () =>
        HttpResponse.json({
          data: '2026-01-13',
          estado: 'FECHADA',
          minutosTrabalhados: 540,
          saldoDia: 60,
          saldoAcumuladoNoPeriodo: 120,
          totalApontadoMinutos: 540,
        }),
      ),
    )

    renderJornadaPainel()

    expect(await screen.findByText('Trabalhado hoje: 9h00')).toBeInTheDocument()
    expect(screen.getByText('Saldo do dia: +1h00')).toBeInTheDocument()
    expect(screen.getByText('Saldo acumulado no período: +2h00')).toBeInTheDocument()
  })

  it('exibe saldo negativo com sinal de menos', async () => {
    server.use(
      http.get('/ponto/jornada-do-dia', () =>
        HttpResponse.json({
          data: '2026-01-13',
          estado: 'ABERTA',
          minutosTrabalhados: 180,
          saldoDia: -300,
          saldoAcumuladoNoPeriodo: -45,
          totalApontadoMinutos: 180,
        }),
      ),
    )

    renderJornadaPainel()

    expect(await screen.findByText('Saldo do dia: -5h00')).toBeInTheDocument()
    expect(screen.getByText('Saldo acumulado no período: -0h45')).toBeInTheDocument()
  })

  it('exibe o estado do dia', async () => {
    server.use(
      http.get('/ponto/jornada-do-dia', () =>
        HttpResponse.json({
          data: '2026-01-13',
          estado: 'INCONSISTENTE',
          minutosTrabalhados: 0,
          saldoDia: -480,
          saldoAcumuladoNoPeriodo: -480,
          totalApontadoMinutos: 0,
        }),
      ),
    )

    renderJornadaPainel()

    expect(await screen.findByText(/inconsistente/i)).toBeInTheDocument()
  })

  it('mostra o total apontado hoje e a diferença em relação ao trabalhado', async () => {
    server.use(
      http.get('/ponto/jornada-do-dia', () =>
        HttpResponse.json({
          data: '2026-01-13',
          estado: 'FECHADA',
          minutosTrabalhados: 540,
          saldoDia: 60,
          saldoAcumuladoNoPeriodo: 120,
          totalApontadoMinutos: 480,
        }),
      ),
    )

    renderJornadaPainel()

    expect(await screen.findByText('Total apontado hoje: 8h00')).toBeInTheDocument()
    expect(screen.getByText('Diferença apontado vs. trabalhado: -1h00')).toBeInTheDocument()
  })

  it('diferença positiva quando o apontado é maior que o trabalhado', async () => {
    server.use(
      http.get('/ponto/jornada-do-dia', () =>
        HttpResponse.json({
          data: '2026-01-13',
          estado: 'ABERTA',
          minutosTrabalhados: 180,
          saldoDia: -300,
          saldoAcumuladoNoPeriodo: -45,
          totalApontadoMinutos: 210,
        }),
      ),
    )

    renderJornadaPainel()

    expect(await screen.findByText('Total apontado hoje: 3h30')).toBeInTheDocument()
    expect(screen.getByText('Diferença apontado vs. trabalhado: +0h30')).toBeInTheDocument()
  })
})
