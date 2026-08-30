import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { RelatoriosPage } from './RelatoriosPage'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
  useAuthStore.getState().definirSessao('token-fake', 'GESTOR')
})

function handlersPadrao() {
  return [
    http.get('/equipes', () => HttpResponse.json([{ id: 1, nome: 'Backend', descricao: null, ativa: true }])),
    http.get('/projetos', () =>
      HttpResponse.json([
        { id: 10, nome: 'Projeto A', cliente: 'Acme', status: 'ATIVO', inicio: '2026-01-01', fimPrevisto: null },
        { id: 11, nome: 'Projeto B', cliente: 'Acme', status: 'ATIVO', inicio: '2026-01-01', fimPrevisto: null },
      ]),
    ),
    http.get('/ajustes/pendentes', () => HttpResponse.json([])),
    http.get('/ponto/espelho-do-mes', () => HttpResponse.json({ dias: [], saldoAcumuladoNoPeriodo: 60 })),
  ]
}

function renderPagina() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <RelatoriosPage />
    </QueryClientProvider>,
  )
}

describe('RelatoriosPage', () => {
  it('mostra o saldo acumulado do usuário', async () => {
    server.use(...handlersPadrao())

    renderPagina()

    expect(await screen.findByText('Saldo acumulado: +1h00')).toBeInTheDocument()
  })

  it('mostra os dias inconsistentes do período informado', async () => {
    server.use(
      ...handlersPadrao(),
      http.get('/ponto/dias-inconsistentes', () => HttpResponse.json(['2026-01-11', '2026-01-12'])),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Saldo acumulado: +1h00')
    await user.type(screen.getByLabelText(/início/i), '2026-01-01')
    await user.type(screen.getByLabelText(/^fim$/i), '2026-02-01')

    expect(await screen.findByText('2026-01-11')).toBeInTheDocument()
    expect(screen.getByText('2026-01-12')).toBeInTheDocument()
  })

  it('trocar o projeto selecionado atualiza o total apontado sem reload manual', async () => {
    server.use(
      ...handlersPadrao(),
      http.get('/apontamentos/relatorio', ({ request }) => {
        const url = new URL(request.url)
        const projetoId = url.searchParams.get('projetoId')
        return HttpResponse.json({ totalMinutos: projetoId === '10' ? 90 : 45 })
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Saldo acumulado: +1h00')
    await user.type(screen.getByLabelText(/início/i), '2026-01-01')
    await user.type(screen.getByLabelText(/^fim$/i), '2026-02-01')
    await user.selectOptions(screen.getByLabelText(/projeto/i), '10')

    expect(await screen.findByText('Total apontado: 1h30')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/projeto/i), '11')

    expect(await screen.findByText('Total apontado: 0h45')).toBeInTheDocument()
  })

  it('mostra as solicitações pendentes', async () => {
    server.use(
      http.get('/ajustes/pendentes', () =>
        HttpResponse.json([
          {
            id: 1,
            usuarioId: 2,
            usuarioNome: 'Beto Lima',
            tipoSolicitado: 'ENTRADA',
            momentoSolicitado: '2026-01-15T09:00:00Z',
            registroAlvoId: null,
            justificativa: 'Esqueci',
            status: 'PENDENTE',
            criadoEm: '2026-01-15T10:00:00Z',
          },
        ]),
      ),
      ...handlersPadrao(),
    )

    renderPagina()

    expect(await screen.findByText('Beto Lima')).toBeInTheDocument()
  })
})
