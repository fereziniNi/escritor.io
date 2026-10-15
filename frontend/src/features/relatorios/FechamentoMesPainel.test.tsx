import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { FechamentoMesPainel } from './FechamentoMesPainel'
import type { FechamentoMes } from './types'

const FECHAMENTO_SETEMBRO: FechamentoMes = {
  mes: '2026-09',
  pessoas: [
    {
      usuarioId: 1,
      nome: 'Ana Souza',
      cargaDiariaMinutos: 480,
      diasTrabalhados: 20,
      minutosTrabalhados: 9690,
      saldoMinutos: 90,
      diasUteisSemMarcacao: 1,
      diasInconsistentes: 0,
    },
    {
      usuarioId: 2,
      nome: 'Beto Lima',
      cargaDiariaMinutos: 360,
      diasTrabalhados: 18,
      minutosTrabalhados: 6330,
      saldoMinutos: -150,
      diasUteisSemMarcacao: 3,
      diasInconsistentes: 2,
    },
  ],
}

const mesesPedidos: string[] = []

const server = setupServer(
  http.get('/admin/ponto/fechamento-mensal', ({ request }) => {
    const mes = new URL(request.url).searchParams.get('mes') ?? ''
    mesesPedidos.push(mes)
    return HttpResponse.json(mes === '2026-09' ? FECHAMENTO_SETEMBRO : { mes, pessoas: [] })
  }),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  mesesPedidos.length = 0
})
afterAll(() => server.close())

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <FechamentoMesPainel />
    </QueryClientProvider>,
  )
}

describe('FechamentoMesPainel', () => {
  it('nasce no mês corrente', async () => {
    renderizar()

    expect(await screen.findByText('Nenhuma pessoa ativa.')).toBeInTheDocument()
    expect(mesesPedidos).toEqual([new Date().toISOString().slice(0, 7)])
  })

  it('mostra horas e saldo de cada pessoa do mês escolhido, com o saldo total', async () => {
    renderizar()
    await screen.findByText('Nenhuma pessoa ativa.')

    fireEvent.change(screen.getByLabelText('Mês do fechamento'), { target: { value: '2026-09' } })

    expect(await screen.findByText('Ana Souza')).toBeInTheDocument()
    expect(screen.getByText('161h30min')).toBeInTheDocument()
    expect(screen.getByText('+1h30min')).toBeInTheDocument()
    expect(screen.getByText('Beto Lima')).toBeInTheDocument()
    expect(screen.getByText('-2h30min')).toBeInTheDocument()
    // saldo da equipe: no cartão de resumo e na linha de total
    expect(screen.getAllByText('-1h')).toHaveLength(2)
    expect(screen.getAllByText('267h')).toHaveLength(2)
    expect(screen.getByText('1 pessoa')).toBeInTheDocument()
  })

  it('baixa o Excel do mês escolhido', async () => {
    const pedidosExcel: string[] = []
    server.use(
      http.get('/admin/ponto/fechamento-mensal', ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('formato') !== 'xlsx') return undefined
        pedidosExcel.push(url.searchParams.get('mes') ?? '')
        return new HttpResponse(new Blob(['xlsx']), {
          headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        })
      }),
    )
    URL.createObjectURL = () => 'blob:fechamento'
    URL.revokeObjectURL = () => {}
    renderizar()
    await screen.findByText('Nenhuma pessoa ativa.')

    fireEvent.change(screen.getByLabelText('Mês do fechamento'), { target: { value: '2026-09' } })
    fireEvent.click(screen.getByRole('button', { name: '⬇️ Exportar Excel' }))

    await waitFor(() => expect(pedidosExcel).toEqual(['2026-09']))
  })

  it('mostra erro quando o fechamento não carrega', async () => {
    server.use(http.get('/admin/ponto/fechamento-mensal', () => new HttpResponse(null, { status: 403 })))
    renderizar()

    expect(await screen.findByText('Não foi possível carregar o fechamento do mês.')).toBeInTheDocument()
  })
})
