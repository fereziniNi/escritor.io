import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { HappyHourPainel } from './HappyHourPainel'

const server = setupServer(http.get('/happy-hour/sorteio', () => new HttpResponse(null, { status: 204 })))

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderPainel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <HappyHourPainel />
    </QueryClientProvider>,
  )
}

describe('HappyHourPainel', () => {
  it('mostra mensagem vazia quando não há nenhuma atividade sugerida ainda', async () => {
    server.use(http.get('/happy-hour/atividades', () => HttpResponse.json([])))

    renderPainel()

    expect(await screen.findByText(/nenhuma atividade sugerida ainda/i)).toBeInTheDocument()
  })

  it('lista as atividades sugeridas, com quem sugeriu', async () => {
    server.use(
      http.get('/happy-hour/atividades', () =>
        HttpResponse.json([{ id: 1, descricao: 'Karaokê', sugeridaPorNome: 'Ana Souza', criadaEm: '2026-01-13T18:00:00Z', sorteadaEm: null }]),
      ),
    )

    renderPainel()

    expect(await screen.findByText('Karaokê')).toBeInTheDocument()
    expect(screen.getByText(/sugerida por ana souza/i)).toBeInTheDocument()
  })

  it('pedido do usuário: "qualquer um pode adicionar uma nova atividade" - sugere e ela aparece na lista', async () => {
    let atividades: unknown[] = []
    server.use(
      http.get('/happy-hour/atividades', () => HttpResponse.json(atividades)),
      http.post('/happy-hour/atividades', async ({ request }) => {
        const corpo = (await request.json()) as { descricao: string }
        const nova = { id: 1, descricao: corpo.descricao, sugeridaPorNome: 'Ana Souza', criadaEm: '2026-01-13T18:00:00Z', sorteadaEm: null }
        atividades = [nova]
        return HttpResponse.json(nova, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText(/nenhuma atividade sugerida ainda/i)
    await user.type(screen.getByLabelText(/sugerir atividade/i), 'Boliche')
    await user.click(screen.getByRole('button', { name: /sugerir/i }))

    expect(await screen.findByText('Boliche')).toBeInTheDocument()
  })

  it('aba Roleta sem nenhuma atividade pede pra sugerir antes de girar', async () => {
    server.use(http.get('/happy-hour/atividades', () => HttpResponse.json([])))
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText(/nenhuma atividade sugerida ainda/i)
    await user.click(screen.getByRole('tab', { name: /roleta/i }))

    expect(await screen.findByText(/sugira pelo menos uma atividade/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /girar roleta/i })).toBeDisabled()
  })

  it('pedido do usuário: "uma parte para roleta onde será sorteado qual atividade" - gira e mostra a escolhida', async () => {
    server.use(
      http.get('/happy-hour/atividades', () =>
        HttpResponse.json([{ id: 1, descricao: 'Karaokê', sugeridaPorNome: 'Ana Souza', criadaEm: '2026-01-13T18:00:00Z', sorteadaEm: null }]),
      ),
      http.post('/happy-hour/sortear', () =>
        HttpResponse.json({
          id: 1,
          descricao: 'Karaokê',
          sugeridaPorNome: 'Ana Souza',
          criadaEm: '2026-01-13T18:00:00Z',
          sorteadaEm: '2026-01-13T19:00:00Z',
        }),
      ),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText('Karaokê')
    await user.click(screen.getByRole('tab', { name: /roleta/i }))
    await user.click(await screen.findByRole('button', { name: /girar roleta/i }))

    expect(await screen.findByText(/atividade escolhida: "karaokê"/i)).toBeInTheDocument()
  })
})
