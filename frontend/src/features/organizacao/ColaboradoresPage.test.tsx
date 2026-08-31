import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { ColaboradoresPage } from './ColaboradoresPage'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
  useAuthStore.getState().definirSessao('token-fake', 'ADMIN')
})

function renderColaboradoresPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ColaboradoresPage />
    </QueryClientProvider>,
  )
}

describe('ColaboradoresPage', () => {
  it('lista os colaboradores existentes com nome, papel e carga diária', async () => {
    server.use(
      http.get('/usuarios', () =>
        HttpResponse.json([{ id: 1, nome: 'Ana Souza', email: 'ana@escritor.io', papel: 'COLABORADOR', cargaDiariaMinutos: 480, ativo: true }]),
      ),
    )

    renderColaboradoresPage()

    const linha = (await screen.findByText('Ana Souza')).closest('li')!
    expect(within(linha).getByText('ana@escritor.io')).toBeInTheDocument()
    expect(within(linha).getByText('Colaborador')).toBeInTheDocument()
    expect(within(linha).getByText(/Hoje: 8h00/)).toBeInTheDocument()
  })

  it('cria um colaborador e atualiza a lista', async () => {
    let colaboradores: Array<{ id: number; nome: string; email: string; papel: string; cargaDiariaMinutos: number; ativo: boolean }> = []
    server.use(
      http.get('/usuarios', () => HttpResponse.json(colaboradores)),
      http.post('/usuarios', async ({ request }) => {
        const corpo = (await request.json()) as { nome: string; email: string; papel: string; cargaDiariaMinutos: number }
        const novo = { id: 1, ...corpo, ativo: true }
        colaboradores = [novo]
        return HttpResponse.json(novo, { status: 201 })
      }),
    )
    const user = userEvent.setup()
    renderColaboradoresPage()

    await user.type(screen.getByLabelText('Nome'), 'Beto Lima')
    await user.type(screen.getByLabelText('E-mail'), 'beto@escritor.io')
    await user.click(screen.getByRole('button', { name: /criar colaborador/i }))

    expect(await screen.findByText('Beto Lima')).toBeInTheDocument()
  })

  it('o botão Salvar da carga diária fica desabilitado até o valor mudar', async () => {
    server.use(
      http.get('/usuarios', () =>
        HttpResponse.json([{ id: 1, nome: 'Ana Souza', email: 'ana@escritor.io', papel: 'COLABORADOR', cargaDiariaMinutos: 480, ativo: true }]),
      ),
    )
    const user = userEvent.setup()
    renderColaboradoresPage()

    await screen.findByText('Ana Souza')
    const campo = screen.getByLabelText('Carga diária de Ana Souza (minutos)')
    const botaoSalvar = screen.getByRole('button', { name: 'Salvar' })
    expect(botaoSalvar).toBeDisabled()

    await user.clear(campo)
    await user.type(campo, '360')
    expect(botaoSalvar).toBeEnabled()
  })

  it('editar a carga diária manda o PATCH e atualiza a lista', async () => {
    let cargaAtual = 480
    server.use(
      http.get('/usuarios', () =>
        HttpResponse.json([{ id: 1, nome: 'Ana Souza', email: 'ana@escritor.io', papel: 'COLABORADOR', cargaDiariaMinutos: cargaAtual, ativo: true }]),
      ),
      http.patch('/usuarios/1/carga-diaria', async ({ request }) => {
        const corpo = (await request.json()) as { cargaDiariaMinutos: number }
        cargaAtual = corpo.cargaDiariaMinutos
        return HttpResponse.json({ id: 1, nome: 'Ana Souza', email: 'ana@escritor.io', papel: 'COLABORADOR', cargaDiariaMinutos: cargaAtual, ativo: true })
      }),
    )
    const user = userEvent.setup()
    renderColaboradoresPage()

    await screen.findByText('Ana Souza')
    const campo = screen.getByLabelText('Carga diária de Ana Souza (minutos)')
    await user.clear(campo)
    await user.type(campo, '360')
    await user.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByText(/Hoje: 6h00/)).toBeInTheDocument()
  })
})
