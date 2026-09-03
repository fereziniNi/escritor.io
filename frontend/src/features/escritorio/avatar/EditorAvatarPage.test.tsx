import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { EditorAvatarPage } from './EditorAvatarPage'

const APARENCIA_INICIAL = {
  corPele: '#f2c9a0',
  estiloCabelo: 'CURTO',
  corCabelo: '#4a3728',
  estiloRoupa: 'CAMISETA',
  corRoupa: '#6b7280',
  oculos: 'NENHUM',
  chapeu: 'NENHUM',
}

// Handler padrão de "aparência ainda padrão" (conta recém-criada), restaurado a cada teste por
// `resetHandlers`; os testes que se importam com o valor sobrescrevem via `server.use(...)`.
const server = setupServer(
  http.get('/usuarios/me', () => HttpResponse.json({ id: 1, nome: 'Ana Souza', aparencia: APARENCIA_INICIAL })),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderPagina() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EditorAvatarPage />
    </QueryClientProvider>,
  )
}

describe('EditorAvatarPage', () => {
  it('mostra erro quando não consegue carregar o usuário', async () => {
    server.use(http.get('/usuarios/me', () => new HttpResponse(null, { status: 500 })))

    renderPagina()

    expect(await screen.findByText(/não foi possível carregar seu avatar/i)).toBeInTheDocument()
  })

  it('abre na aba Base com os controles de pele e cabelo', async () => {
    renderPagina()

    expect(await screen.findByRole('tab', { name: 'Base' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('group', { name: /cor de pele/i })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /cor de cabelo/i })).toBeInTheDocument()
    // pré-preenchido com o que veio do servidor
    expect(screen.getByRole('button', { name: 'Curto' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('troca pra aba Roupas e mostra estilo/cor de roupa', async () => {
    const user = userEvent.setup()
    renderPagina()
    await screen.findByRole('tab', { name: 'Base' })

    await user.click(screen.getByRole('tab', { name: 'Roupas' }))

    expect(screen.getByRole('button', { name: 'Camiseta' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('group', { name: /cor de roupa/i })).toBeInTheDocument()
  })

  it('troca pra aba Acessórios e mostra óculos/chapéu', async () => {
    const user = userEvent.setup()
    renderPagina()
    await screen.findByRole('tab', { name: 'Base' })

    await user.click(screen.getByRole('tab', { name: 'Acessórios' }))

    const grupoOculos = screen.getByRole('group', { name: 'Óculos' })
    expect(within(grupoOculos).getByRole('button', { name: 'Nenhum' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(grupoOculos).getByRole('button', { name: 'Redondo' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Chapéu' })).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: 'Chapéu' })).getByRole('button', { name: 'Boné' })).toBeInTheDocument()
  })

  it('escolher um estilo diferente marca ele como selecionado', async () => {
    const user = userEvent.setup()
    renderPagina()
    await screen.findByRole('tab', { name: 'Base' })

    await user.click(screen.getByRole('button', { name: 'Longo' }))

    expect(screen.getByRole('button', { name: 'Longo' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Curto' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('finalizar salva a aparência escolhida', async () => {
    server.use(
      http.patch('/usuarios/me/aparencia', async ({ request }) => {
        const corpo = (await request.json()) as typeof APARENCIA_INICIAL
        expect(corpo.estiloCabelo).toBe('LONGO')
        return HttpResponse.json({ id: 1, nome: 'Ana Souza', aparencia: { ...APARENCIA_INICIAL, estiloCabelo: 'LONGO' } })
      }),
    )
    const user = userEvent.setup()
    renderPagina()
    await screen.findByRole('tab', { name: 'Base' })

    await user.click(screen.getByRole('button', { name: 'Longo' }))
    await user.click(screen.getByRole('button', { name: /finalizar/i }))

    expect(await screen.findByText(/aparência salva/i)).toBeInTheDocument()
  })

  it('mostra erro quando salvar falha', async () => {
    server.use(http.patch('/usuarios/me/aparencia', () => new HttpResponse(null, { status: 400 })))
    const user = userEvent.setup()
    renderPagina()
    await screen.findByRole('tab', { name: 'Base' })

    await user.click(screen.getByRole('button', { name: /finalizar/i }))

    expect(await screen.findByText(/não foi possível salvar a aparência/i)).toBeInTheDocument()
  })
})
