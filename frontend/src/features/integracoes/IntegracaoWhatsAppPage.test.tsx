import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { IntegracaoWhatsAppPage } from './IntegracaoWhatsAppPage'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderPagina() {
  // refetchInterval é curto de propósito no componente (polling enquanto aguarda o QR ser
  // escaneado) - `retry: false` evita qualquer nova tentativa mascarar o que o teste quer ver.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <IntegracaoWhatsAppPage />
    </QueryClientProvider>,
  )
}

describe('IntegracaoWhatsAppPage', () => {
  it('mostra que já está conectado', async () => {
    server.use(http.get('/admin/whatsapp/estado', () => HttpResponse.json({ situacao: 'CONECTADO', qrCodeBase64: null, mensagem: null })))

    renderPagina()

    expect(await screen.findByText(/conectado/i)).toBeInTheDocument()
  })

  it('mostra o QR code e as instruções quando aguardando conexão', async () => {
    server.use(
      http.get('/admin/whatsapp/estado', () =>
        HttpResponse.json({ situacao: 'AGUARDANDO_QRCODE', qrCodeBase64: 'data:image/png;base64,abc123', mensagem: null }),
      ),
    )

    renderPagina()

    const imagem = await screen.findByRole('img', { name: /qr code/i })
    expect(imagem).toHaveAttribute('src', 'data:image/png;base64,abc123')
    expect(screen.getByText(/aparelhos conectados/i)).toBeInTheDocument()
  })

  it('mostra erro quando aguardando conexão mas sem QR code disponível', async () => {
    server.use(
      http.get('/admin/whatsapp/estado', () => HttpResponse.json({ situacao: 'AGUARDANDO_QRCODE', qrCodeBase64: null, mensagem: null })),
    )

    renderPagina()

    expect(await screen.findByText(/não foi possível gerar o qr code/i)).toBeInTheDocument()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('mostra a mensagem de indisponível vinda do backend', async () => {
    server.use(
      http.get('/admin/whatsapp/estado', () =>
        HttpResponse.json({ situacao: 'INDISPONIVEL', qrCodeBase64: null, mensagem: 'Integração desligada (app.evolution.habilitado=false).' }),
      ),
    )

    renderPagina()

    expect(await screen.findByText(/integração desligada/i)).toBeInTheDocument()
  })

  it('mostra erro quando a consulta ao backend falha', async () => {
    server.use(http.get('/admin/whatsapp/estado', () => new HttpResponse(null, { status: 403 })))

    renderPagina()

    expect(await screen.findByText(/não foi possível consultar/i)).toBeInTheDocument()
  })
})
