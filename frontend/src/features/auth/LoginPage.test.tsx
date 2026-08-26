import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from './authStore'
import { LoginPage } from './LoginPage'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
})

function renderLoginPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<p>Página inicial</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('LoginPage', () => {
  it('pede o código após enviar um e-mail válido', async () => {
    server.use(http.post('/auth/codigo', () => new HttpResponse(null, { status: 202 })))
    const user = userEvent.setup()
    renderLoginPage()

    await user.type(screen.getByLabelText(/e-mail/i), 'ana@escritor.io')
    await user.click(screen.getByRole('button', { name: /enviar código/i }))

    expect(await screen.findByLabelText(/código/i)).toBeInTheDocument()
  })

  it('autentica e navega para a página inicial com o código correto', async () => {
    server.use(
      http.post('/auth/codigo', () => new HttpResponse(null, { status: 202 })),
      http.post('/auth/login', () =>
        HttpResponse.json({
          accessToken:
            'eyJhbGciOiJIUzUxMiJ9.eyJzdWIiOiIxIiwicGFwZWwiOiJHRVNUT1IiLCJleHAiOjE5OTk5OTk5OTl9.assinatura',
        }),
      ),
    )
    const user = userEvent.setup()
    renderLoginPage()

    await user.type(screen.getByLabelText(/e-mail/i), 'ana@escritor.io')
    await user.click(screen.getByRole('button', { name: /enviar código/i }))
    await user.type(await screen.findByLabelText(/código/i), '123456')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    await waitFor(() => expect(screen.getByText('Página inicial')).toBeInTheDocument())
    expect(useAuthStore.getState().autenticado).toBe(true)
    expect(useAuthStore.getState().papel).toBe('GESTOR')
  })

  it('mostra erro quando o código está incorreto', async () => {
    server.use(
      http.post('/auth/codigo', () => new HttpResponse(null, { status: 202 })),
      http.post('/auth/login', () => new HttpResponse(null, { status: 401 })),
    )
    const user = userEvent.setup()
    renderLoginPage()

    await user.type(screen.getByLabelText(/e-mail/i), 'ana@escritor.io')
    await user.click(screen.getByRole('button', { name: /enviar código/i }))
    await user.type(await screen.findByLabelText(/código/i), '000000')
    await user.click(screen.getByRole('button', { name: /entrar/i }))

    expect(await screen.findByText(/código inválido/i)).toBeInTheDocument()
    expect(useAuthStore.getState().autenticado).toBe(false)
  })
})
