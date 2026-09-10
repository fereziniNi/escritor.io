import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { EditarPerfilForm } from './EditarPerfilForm'

const APARENCIA_QUALQUER = { corPele: '#f2c9a0' }

const server = setupServer(
  http.get('/usuarios/me', () => HttpResponse.json({ id: 1, nome: 'Ana Souza', email: 'ana@escritor.io', aparencia: APARENCIA_QUALQUER })),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderFormulario() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EditarPerfilForm />
    </QueryClientProvider>,
  )
}

describe('EditarPerfilForm', () => {
  it('preenche os campos com o nome e e-mail atuais', async () => {
    renderFormulario()

    expect(await screen.findByLabelText('Nome')).toHaveValue('Ana Souza')
    expect(screen.getByLabelText('E-mail')).toHaveValue('ana@escritor.io')
  })

  it('mostra erro quando não consegue carregar o perfil', async () => {
    server.use(http.get('/usuarios/me', () => new HttpResponse(null, { status: 500 })))

    renderFormulario()

    expect(await screen.findByText(/não foi possível carregar seu perfil/i)).toBeInTheDocument()
  })

  it('salva o nome e e-mail editados', async () => {
    let corpoEnviado: unknown = null
    server.use(
      http.patch('/usuarios/me/perfil', async ({ request }) => {
        corpoEnviado = await request.json()
        return HttpResponse.json({ id: 1, nome: 'Ana Souza Lima', email: 'ana.lima@escritor.io', aparencia: APARENCIA_QUALQUER })
      }),
    )
    const user = userEvent.setup()
    renderFormulario()

    const campoNome = await screen.findByLabelText('Nome')
    await user.clear(campoNome)
    await user.type(campoNome, 'Ana Souza Lima')
    const campoEmail = screen.getByLabelText('E-mail')
    await user.clear(campoEmail)
    await user.type(campoEmail, 'ana.lima@escritor.io')
    await user.click(screen.getByRole('button', { name: /salvar/i }))

    expect(corpoEnviado).toEqual({ nome: 'Ana Souza Lima', email: 'ana.lima@escritor.io' })
    expect(await screen.findByText(/perfil atualizado/i)).toBeInTheDocument()
  })

  it('mostra a mensagem de e-mail já cadastrado quando o backend rejeita', async () => {
    server.use(http.patch('/usuarios/me/perfil', () => new HttpResponse(null, { status: 409 })))
    const user = userEvent.setup()
    renderFormulario()

    await screen.findByLabelText('Nome')
    await user.click(screen.getByRole('button', { name: /salvar/i }))

    expect(await screen.findByText(/já está em uso por outra pessoa/i)).toBeInTheDocument()
  })
})
