import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { SugestaoRegistrarEntrada } from './SugestaoRegistrarEntrada'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderComponente(aoClicarRegistrar: () => void = () => {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <SugestaoRegistrarEntrada aoClicarRegistrar={aoClicarRegistrar} />
    </QueryClientProvider>,
  )
  return queryClient
}

/** Espera a query resolver de verdade (não só o mock ser chamado) antes de afirmar ausência de algo. */
async function esperarQueryResolvida(queryClient: QueryClient) {
  await waitFor(() => {
    expect(queryClient.getQueryState(['ponto', 'estado-atual'])?.status).toBe('success')
  })
}

describe('SugestaoRegistrarEntrada', () => {
  it('mostra o aviso quando o usuário nunca bateu ponto hoje (ultimoTipo nulo)', async () => {
    server.use(http.get('/ponto/estado-atual', () => HttpResponse.json({ ultimoTipo: null, proximasOpcoes: ['ENTRADA'] })))

    renderComponente()

    expect(await screen.findByRole('alert')).toHaveTextContent('Você ainda não registrou entrada hoje.')
  })

  it('mostra o aviso quando o último registro foi SAIDA (jornada já encerrada)', async () => {
    server.use(http.get('/ponto/estado-atual', () => HttpResponse.json({ ultimoTipo: 'SAIDA', proximasOpcoes: ['ENTRADA'] })))

    renderComponente()

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('clicar no botão do aviso chama aoClicarRegistrar, pra abrir o painel de ponto', async () => {
    server.use(http.get('/ponto/estado-atual', () => HttpResponse.json({ ultimoTipo: null, proximasOpcoes: ['ENTRADA'] })))
    const aoClicarRegistrar = vi.fn()

    renderComponente(aoClicarRegistrar)

    fireEvent.click(await screen.findByRole('button', { name: 'Ir pra tela de ponto' }))
    expect(aoClicarRegistrar).toHaveBeenCalledOnce()
  })

  it('não mostra nada quando o ponto está aberto (ENTRADA)', async () => {
    server.use(http.get('/ponto/estado-atual', () => HttpResponse.json({ ultimoTipo: 'ENTRADA', proximasOpcoes: ['PAUSA_INICIO', 'SAIDA'] })))

    const queryClient = renderComponente()

    await esperarQueryResolvida(queryClient)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('não mostra nada durante uma pausa (ponto ainda aberto)', async () => {
    server.use(http.get('/ponto/estado-atual', () => HttpResponse.json({ ultimoTipo: 'PAUSA_INICIO', proximasOpcoes: ['PAUSA_FIM'] })))

    const queryClient = renderComponente()

    await esperarQueryResolvida(queryClient)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
