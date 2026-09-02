import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { RelatoriosPage } from './RelatoriosPage'

// Pedido do cliente: filtrar relatório por pessoa é por nome, não por id - handler padrão
// restaurado a cada teste por `resetHandlers`.
const PESSOAS_CADASTRADAS = [
  { id: 1, nome: 'Ana Souza' },
  { id: 2, nome: 'Beto Lima' },
]

const server = setupServer(http.get('/usuarios/basico', () => HttpResponse.json(PESSOAS_CADASTRADAS)))

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
    http.get('/projetos', () =>
      HttpResponse.json([
        { id: 10, nome: 'Projeto A', cliente: 'Acme', status: 'ATIVO', inicio: '2026-01-01', fimPrevisto: null },
        { id: 11, nome: 'Projeto B', cliente: 'Acme', status: 'ATIVO', inicio: '2026-01-01', fimPrevisto: null },
      ]),
    ),
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

    // exibido em dd/mm/aaaa, não a data ISO crua que a API devolve (pedido do usuário)
    expect(await screen.findByText('11/01/2026')).toBeInTheDocument()
    expect(screen.getByText('12/01/2026')).toBeInTheDocument()
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

  it('digita o nome de uma pessoa cadastrada e filtra o saldo por ela', async () => {
    // Não usa `handlersPadrao()` aqui: ela já registra um handler estático pra
    // `/ponto/espelho-do-mes`, e o primeiro handler cadastrado pra uma rota "ganha" no MSW - o
    // handler abaixo (que lê `usuarioId` da query) nunca seria chamado se viesse depois dele.
    server.use(
      http.get('/projetos', () => HttpResponse.json([])),
      http.get('/ponto/espelho-do-mes', ({ request }) => {
        const url = new URL(request.url)
        const usuarioId = url.searchParams.get('usuarioId')
        return HttpResponse.json({ dias: [], saldoAcumuladoNoPeriodo: usuarioId === '2' ? 120 : 60 })
      }),
    )
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Saldo acumulado: +1h00')
    // pedido do usuário: digita o nome, não o id - "Beto Lima" está entre as pessoas cadastradas.
    await user.type(screen.getByLabelText(/usuário/i), 'Beto Lima')

    expect(await screen.findByText('Saldo acumulado: +2h00')).toBeInTheDocument()
  })

  it('nome que não bate com nenhuma pessoa cadastrada mostra "Pessoa não encontrada" e não dispara a consulta', async () => {
    server.use(...handlersPadrao())
    const user = userEvent.setup()
    renderPagina()

    await screen.findByText('Saldo acumulado: +1h00')
    await user.type(screen.getByLabelText(/usuário/i), 'Alguém que não existe')

    expect(await screen.findByText(/pessoa não encontrada/i)).toBeInTheDocument()
    // sem usuário resolvido, o saldo anterior (do "eu mesmo" inicial) some da tela.
    expect(screen.queryByText(/saldo acumulado/i)).not.toBeInTheDocument()
  })
})
