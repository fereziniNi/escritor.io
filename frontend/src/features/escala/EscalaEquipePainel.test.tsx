import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { EscalaEquipePainel } from './EscalaEquipePainel'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderPainel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EscalaEquipePainel />
    </QueryClientProvider>,
  )
}

describe('EscalaEquipePainel', () => {
  it('lista cada colaborador visível com o horário efetivo de cada dia da semana', async () => {
    server.use(
      http.get('/escala/equipe', () =>
        HttpResponse.json([
          {
            usuarioId: 1,
            usuarioNome: 'Ana Souza',
            dias: [
              { data: '2026-01-05', trabalha: true, horaInicio: '09:00:00', horaFim: '18:00:00' },
              { data: '2026-01-06', trabalha: false, horaInicio: null, horaFim: null },
            ],
          },
        ]),
      ),
    )

    renderPainel()

    const linha = (await screen.findByText('Ana Souza')).closest('tr')!
    expect(within(linha).getByText('09:00–18:00')).toBeInTheDocument()
    expect(within(linha).getByText('—')).toBeInTheDocument()
  })

  it('mostra mensagem vazia quando ninguém é visível', async () => {
    server.use(http.get('/escala/equipe', () => HttpResponse.json([])))

    renderPainel()

    expect(await screen.findByText(/ninguém visível pra você/i)).toBeInTheDocument()
  })

  it('mostra erro quando a consulta falha', async () => {
    server.use(http.get('/escala/equipe', () => new HttpResponse(null, { status: 500 })))

    renderPainel()

    expect(await screen.findByText(/não foi possível carregar a escala da equipe/i)).toBeInTheDocument()
  })

  it('navega pra semana seguinte e volta', async () => {
    let intervalosConsultados: string[] = []
    server.use(
      http.get('/escala/equipe', ({ request }) => {
        const url = new URL(request.url)
        intervalosConsultados.push(`${url.searchParams.get('inicio')}..${url.searchParams.get('fim')}`)
        return HttpResponse.json([])
      }),
    )
    const user = userEvent.setup()
    renderPainel()

    await screen.findByText(/ninguém visível pra você/i)
    const primeiroIntervalo = intervalosConsultados[0]

    await user.click(screen.getByLabelText(/próxima semana/i))
    await screen.findByText(/ninguém visível pra você/i)
    expect(intervalosConsultados[1]).not.toBe(primeiroIntervalo)

    await user.click(screen.getByLabelText(/semana anterior/i))
    await screen.findByText(/ninguém visível pra você/i)
    expect(intervalosConsultados.at(-1)).toBe(primeiroIntervalo)
  })
})
