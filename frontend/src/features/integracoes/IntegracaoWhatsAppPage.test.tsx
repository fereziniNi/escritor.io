import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { IntegracaoWhatsAppPage } from './IntegracaoWhatsAppPage'

// `IntegracaoWhatsAppPage` agora também busca a configuração do resumo diário ao montar -
// handler padrão de "ainda não configurado", restaurado a cada teste por `resetHandlers`; os
// testes que se importam com o resumo diário sobrescrevem via `server.use(...)`.
const server = setupServer(
  http.get('/admin/relatorio-diario', () => HttpResponse.json({ configurado: false, horarioEnvio: null, habilitado: false })),
)

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

  describe('resumo diário', () => {
    it('campo de horário vazio quando ainda não foi configurado', async () => {
      server.use(
        http.get('/admin/whatsapp/estado', () => HttpResponse.json({ situacao: 'CONECTADO', qrCodeBase64: null, mensagem: null })),
      )

      renderPagina()

      const campoHorario = await screen.findByLabelText(/horário de envio/i)
      expect(campoHorario).toHaveValue('')
    })

    it('pré-preenche com o horário já configurado', async () => {
      server.use(
        http.get('/admin/whatsapp/estado', () => HttpResponse.json({ situacao: 'CONECTADO', qrCodeBase64: null, mensagem: null })),
        http.get('/admin/relatorio-diario', () => HttpResponse.json({ configurado: true, horarioEnvio: '18:00:00', habilitado: true })),
      )

      renderPagina()

      const campoHorario = await screen.findByLabelText(/horário de envio/i)
      expect(campoHorario).toHaveValue('18:00')
      expect(screen.getByLabelText(/habilitado/i)).toBeChecked()
    })

    it('salva o horário escolhido pelo admin', async () => {
      server.use(
        http.get('/admin/whatsapp/estado', () => HttpResponse.json({ situacao: 'CONECTADO', qrCodeBase64: null, mensagem: null })),
        http.put('/admin/relatorio-diario', async ({ request }) => {
          const corpo = (await request.json()) as { horarioEnvio: string; habilitado: boolean }
          expect(corpo.horarioEnvio).toBe('19:30:00')
          expect(corpo.habilitado).toBe(true)
          return HttpResponse.json({ configurado: true, horarioEnvio: corpo.horarioEnvio, habilitado: corpo.habilitado })
        }),
      )
      const user = userEvent.setup()
      renderPagina()

      const campoHorario = await screen.findByLabelText(/horário de envio/i)
      await user.type(campoHorario, '19:30')
      const campoHabilitado = screen.getByLabelText(/habilitado/i)
      if (!(campoHabilitado as HTMLInputElement).checked) {
        await user.click(campoHabilitado)
      }
      await user.click(screen.getByRole('button', { name: /salvar/i }))

      expect(await screen.findByText(/horário salvo/i)).toBeInTheDocument()
    })

    it('mostra erro quando salvar falha', async () => {
      server.use(
        http.get('/admin/whatsapp/estado', () => HttpResponse.json({ situacao: 'CONECTADO', qrCodeBase64: null, mensagem: null })),
        http.put('/admin/relatorio-diario', () => new HttpResponse(null, { status: 500 })),
      )
      const user = userEvent.setup()
      renderPagina()

      const campoHorario = await screen.findByLabelText(/horário de envio/i)
      await user.type(campoHorario, '19:30')
      await user.click(screen.getByRole('button', { name: /salvar/i }))

      expect(await screen.findByText(/não foi possível salvar o horário/i)).toBeInTheDocument()
    })
  })
})
