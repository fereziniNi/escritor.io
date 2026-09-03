import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { APARENCIA_PADRAO } from './aparenciaAvatar'
import { EditorAvatarPage } from './EditorAvatarPage'

// Handler padrão de "aparência ainda padrão" (conta recém-criada), restaurado a cada teste por
// `resetHandlers`; os testes que se importam com o valor sobrescrevem via `server.use(...)`.
const server = setupServer(
  http.get('/usuarios/me', () => HttpResponse.json({ id: 1, nome: 'Ana Souza', aparencia: APARENCIA_PADRAO })),
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

  it('abre na aba Base, com Pele/Cabelo/Barba', async () => {
    renderPagina()

    expect(await screen.findByRole('tab', { name: 'Base' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('group', { name: /cor de pele/i })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: /estilo de cabelo/i })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Barba' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nenhuma' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('troca pra aba Roupas e depois Acessórios', async () => {
    const user = userEvent.setup()
    renderPagina()
    await screen.findByRole('tab', { name: 'Base' })

    await user.click(screen.getByRole('tab', { name: 'Roupas' }))
    expect(screen.getByRole('group', { name: /estilo de roupa/i })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Acessórios' }))
    expect(screen.getByRole('group', { name: 'Óculos' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Chapéu' })).toBeInTheDocument()
  })

  it('escolher uma barba marca ela como selecionada', async () => {
    const user = userEvent.setup()
    renderPagina()
    await screen.findByRole('tab', { name: 'Base' })

    await user.click(screen.getByRole('button', { name: 'Cavanhaque' }))

    expect(screen.getByRole('button', { name: 'Cavanhaque' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Nenhuma' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('finalizar salva a aparência escolhida', async () => {
    server.use(
      http.patch('/usuarios/me/aparencia', async ({ request }) => {
        const corpo = (await request.json()) as { tipoBarba: string }
        expect(corpo.tipoBarba).toBe('BARBA_CHEIA')
        return HttpResponse.json({ id: 1, nome: 'Ana Souza', aparencia: { ...APARENCIA_PADRAO, tipoBarba: 'BARBA_CHEIA' } })
      }),
    )
    const user = userEvent.setup()
    renderPagina()
    await screen.findByRole('tab', { name: 'Base' })

    await user.click(screen.getByRole('button', { name: 'Barba cheia' }))
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
