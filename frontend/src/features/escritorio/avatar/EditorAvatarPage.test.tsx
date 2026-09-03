import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { EditorAvatarPage } from './EditorAvatarPage'

// Handler padrão de "personagem ainda padrão" (conta recém-criada), restaurado a cada teste por
// `resetHandlers`; os testes que se importam com o valor sobrescrevem via `server.use(...)`.
const server = setupServer(
  http.get('/usuarios/me', () => HttpResponse.json({ id: 1, nome: 'Ana Souza', personagem: 'PERSONAGEM_VERDE' })),
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

  it('mostra a galeria com os 6 personagens e pré-seleciona o atual', async () => {
    renderPagina()

    expect(await screen.findByRole('group', { name: /escolha o personagem/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /verde/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /vermelho/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /roxo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /chapéu/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cinza/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /bandana/i })).toBeInTheDocument()
  })

  it('escolher outro personagem marca ele como selecionado', async () => {
    const user = userEvent.setup()
    renderPagina()
    await screen.findByRole('group', { name: /escolha o personagem/i })

    await user.click(screen.getByRole('button', { name: /roxo/i }))

    expect(screen.getByRole('button', { name: /roxo/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /verde/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('finalizar salva o personagem escolhido', async () => {
    server.use(
      http.patch('/usuarios/me/aparencia', async ({ request }) => {
        const corpo = (await request.json()) as { personagem: string }
        expect(corpo.personagem).toBe('PERSONAGEM_BANDANA')
        return HttpResponse.json({ id: 1, nome: 'Ana Souza', personagem: 'PERSONAGEM_BANDANA' })
      }),
    )
    const user = userEvent.setup()
    renderPagina()
    await screen.findByRole('group', { name: /escolha o personagem/i })

    await user.click(screen.getByRole('button', { name: /bandana/i }))
    await user.click(screen.getByRole('button', { name: /finalizar/i }))

    expect(await screen.findByText(/personagem salvo/i)).toBeInTheDocument()
  })

  it('mostra erro quando salvar falha', async () => {
    server.use(http.patch('/usuarios/me/aparencia', () => new HttpResponse(null, { status: 400 })))
    const user = userEvent.setup()
    renderPagina()
    await screen.findByRole('group', { name: /escolha o personagem/i })

    await user.click(screen.getByRole('button', { name: /finalizar/i }))

    expect(await screen.findByText(/não foi possível salvar o personagem/i)).toBeInTheDocument()
  })
})
