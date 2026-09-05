import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ConectarGoogleAgenda } from './ConectarGoogleAgenda'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderWidget() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <ConectarGoogleAgenda />
    </QueryClientProvider>,
  )
}

describe('ConectarGoogleAgenda', () => {
  it('não renderiza nada quando a integração não está habilitada neste ambiente', async () => {
    server.use(http.get('/integracoes/google/estado', () => HttpResponse.json({ habilitado: false, conectado: false })))

    const { container } = renderWidget()

    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(container).toBeEmptyDOMElement()
  })

  it('mostra "Conectar" quando habilitado mas ainda não conectado', async () => {
    server.use(http.get('/integracoes/google/estado', () => HttpResponse.json({ habilitado: true, conectado: false })))

    renderWidget()

    expect(await screen.findByRole('button', { name: /conectar google agenda/i })).toBeInTheDocument()
  })

  it('mostra "Conectado" e permite desconectar quando já conectado', async () => {
    let desconectado = false
    server.use(
      http.get('/integracoes/google/estado', () =>
        HttpResponse.json({ habilitado: true, conectado: !desconectado }),
      ),
      http.delete('/integracoes/google', () => {
        desconectado = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    const user = userEvent.setup()
    renderWidget()

    expect(await screen.findByText(/está sendo publicada/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /desconectar/i }))

    expect(await screen.findByRole('button', { name: /conectar google agenda/i })).toBeInTheDocument()
  })
})
