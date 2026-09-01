import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { JornadaPainel } from './JornadaPainel'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const JORNADA_PADRAO = {
  data: '2026-01-15',
  estado: 'ABERTA',
  minutosTrabalhados: 480,
  saldoDia: 0,
  saldoAcumuladoNoPeriodo: 0,
  totalApontadoMinutos: 120,
}

function handlerPorCard(itens: Array<{ cardId: number; cardTitulo: string; totalMinutos: number }>) {
  return http.get('/apontamentos', () => HttpResponse.json(itens))
}

function renderJornadaPainel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <JornadaPainel />
    </QueryClientProvider>,
  )
}

describe('JornadaPainel', () => {
  it('mostra só "Trabalhado hoje" - sem estado do dia, saldo ou total apontado agregado (pedido do usuário)', async () => {
    server.use(
      http.get('/ponto/jornada-do-dia', () => HttpResponse.json(JORNADA_PADRAO)),
      handlerPorCard([]),
    )

    renderJornadaPainel()

    expect(await screen.findByText('8h00')).toBeInTheDocument()
    expect(screen.getByText('Trabalhado hoje')).toBeInTheDocument()
    expect(screen.queryByText('Estado do dia')).not.toBeInTheDocument()
    expect(screen.queryByText('Saldo do dia')).not.toBeInTheDocument()
    expect(screen.queryByText('Saldo acumulado no período')).not.toBeInTheDocument()
    expect(screen.queryByText('Total apontado hoje')).not.toBeInTheDocument()
    expect(screen.queryByText('Apontado vs. trabalhado')).not.toBeInTheDocument()
  })

  it('lista quanto tempo foi apontado em cada tarefa hoje', async () => {
    server.use(
      http.get('/ponto/jornada-do-dia', () => HttpResponse.json(JORNADA_PADRAO)),
      handlerPorCard([
        { cardId: 1, cardTitulo: 'Corrigir bug de login', totalMinutos: 90 },
        { cardId: 2, cardTitulo: 'Revisar PR', totalMinutos: 30 },
      ]),
    )

    renderJornadaPainel()

    expect(await screen.findByText('Corrigir bug de login')).toBeInTheDocument()
    expect(screen.getByText('1h30')).toBeInTheDocument()
    expect(screen.getByText('Revisar PR')).toBeInTheDocument()
    expect(screen.getByText('0h30')).toBeInTheDocument()
  })

  it('mostra aviso quando nenhuma tarefa foi apontada hoje', async () => {
    server.use(
      http.get('/ponto/jornada-do-dia', () => HttpResponse.json(JORNADA_PADRAO)),
      handlerPorCard([]),
    )

    renderJornadaPainel()

    expect(await screen.findByText('Nenhuma tarefa apontada hoje.')).toBeInTheDocument()
  })

  it('mostra erro quando a jornada do dia falha ao carregar', async () => {
    server.use(
      http.get('/ponto/jornada-do-dia', () => new HttpResponse(null, { status: 500 })),
      handlerPorCard([]),
    )

    renderJornadaPainel()

    expect(await screen.findByText('Não foi possível carregar a jornada do dia.')).toBeInTheDocument()
  })
})
