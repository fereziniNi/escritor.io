import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
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

  it('abre com as 11 categorias na nav, começando em Skin', async () => {
    renderPagina()

    const nav = await screen.findByRole('navigation', { name: /categorias de personalização/i })
    for (const rotulo of ['Skin', 'Face', 'Hair', 'Facial hair', 'Top', 'Jacket', 'Bottom', 'Shoes', 'Hat', 'Glasses', 'Other']) {
      expect(within(nav).getByRole('button', { name: rotulo })).toBeInTheDocument()
    }
    expect(within(nav).getByRole('button', { name: 'Skin' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('group', { name: /cor de pele/i })).toBeInTheDocument()
  })

  it('categoria Face mostra grade de estilo (formato do rosto) sem paleta de cor própria', async () => {
    const user = userEvent.setup()
    renderPagina()
    await screen.findByRole('navigation', { name: /categorias de personalização/i })

    await user.click(screen.getByRole('button', { name: 'Face' }))

    const grade = screen.getByRole('group', { name: 'Estilo' })
    expect(within(grade).getAllByRole('button').length).toBeGreaterThanOrEqual(8)
    expect(screen.queryByRole('group', { name: /cor de/i })).not.toBeInTheDocument()
  })

  it('categoria Hair mostra grade de estilo com bem mais de 4 opções + paleta de cor', async () => {
    const user = userEvent.setup()
    renderPagina()
    await screen.findByRole('navigation', { name: /categorias de personalização/i })

    await user.click(screen.getByRole('button', { name: 'Hair' }))

    const grade = screen.getByRole('group', { name: 'Estilo' })
    expect(within(grade).getAllByRole('button').length).toBeGreaterThanOrEqual(10)
    expect(screen.getByRole('group', { name: /cor de cabelo/i })).toBeInTheDocument()
  })

  it('categoria Facial hair não mostra paleta de cor própria', async () => {
    const user = userEvent.setup()
    renderPagina()
    await screen.findByRole('navigation', { name: /categorias de personalização/i })

    await user.click(screen.getByRole('button', { name: 'Facial hair' }))

    const grade = screen.getByRole('group', { name: 'Estilo' })
    expect(within(grade).getAllByRole('button').length).toBeGreaterThanOrEqual(8)
    expect(screen.queryByRole('group', { name: /cor de/i })).not.toBeInTheDocument()
  })

  it('escolher uma opção na grade marca ela como selecionada', async () => {
    const user = userEvent.setup()
    renderPagina()
    await screen.findByRole('navigation', { name: /categorias de personalização/i })
    await user.click(screen.getByRole('button', { name: 'Top' }))

    const opcaoPolo = screen.getByRole('button', { name: /polo/i })
    await user.click(opcaoPolo)

    expect(opcaoPolo).toHaveAttribute('aria-pressed', 'true')
  })

  it('finalizar salva a aparência escolhida', async () => {
    server.use(
      http.patch('/usuarios/me/aparencia', async ({ request }) => {
        const corpo = (await request.json()) as { estiloTop: string }
        expect(corpo.estiloTop).toBe('POLO')
        return HttpResponse.json({ id: 1, nome: 'Ana Souza', aparencia: { ...APARENCIA_PADRAO, estiloTop: 'POLO' } })
      }),
    )
    const user = userEvent.setup()
    renderPagina()
    await screen.findByRole('navigation', { name: /categorias de personalização/i })

    await user.click(screen.getByRole('button', { name: 'Top' }))
    await user.click(screen.getByRole('button', { name: /polo/i }))
    await user.click(screen.getByRole('button', { name: /finalizar/i }))

    expect(await screen.findByText(/aparência salva/i)).toBeInTheDocument()
  })

  it('mostra erro quando salvar falha', async () => {
    server.use(http.patch('/usuarios/me/aparencia', () => new HttpResponse(null, { status: 400 })))
    const user = userEvent.setup()
    renderPagina()
    await screen.findByRole('navigation', { name: /categorias de personalização/i })

    await user.click(screen.getByRole('button', { name: /finalizar/i }))

    expect(await screen.findByText(/não foi possível salvar a aparência/i)).toBeInTheDocument()
  })
})
