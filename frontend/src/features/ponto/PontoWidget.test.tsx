import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { PontoWidget } from './PontoWidget'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
  useAuthStore.getState().definirSessao('token-fake', 'COLABORADOR')
})

function renderPontoWidget() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <PontoWidget />
    </QueryClientProvider>,
  )
}

describe('PontoWidget', () => {
  it('quem nunca marcou vê só a opção de iniciar trabalho', async () => {
    server.use(
      http.get('/ponto/estado-atual', () =>
        HttpResponse.json({ ultimoTipo: null, ultimoMomento: null, proximasOpcoes: ['ENTRADA'] }),
      ),
    )

    renderPontoWidget()

    expect(await screen.findByRole('button', { name: 'Iniciar trabalho' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Encerrar trabalho' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pausar' })).not.toBeInTheDocument()
  })

  it('quem está trabalhando vê Pausar e Encerrar trabalho, nessa ordem', async () => {
    server.use(
      http.get('/ponto/estado-atual', () =>
        HttpResponse.json({
          ultimoTipo: 'ENTRADA',
          ultimoMomento: '2026-01-15T12:00:00Z',
          proximasOpcoes: ['SAIDA', 'PAUSA_INICIO'],
        }),
      ),
    )

    renderPontoWidget()

    expect(await screen.findByRole('button', { name: 'Pausar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Encerrar trabalho' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Iniciar trabalho' })).not.toBeInTheDocument()
    const botoes = screen.getAllByRole('button').map((botao) => botao.textContent)
    expect(botoes).toEqual(['Pausar', 'Encerrar trabalho'])
  })

  it('quem está em pausa vê Voltar ao trabalho e Encerrar trabalho, nessa ordem', async () => {
    server.use(
      http.get('/ponto/estado-atual', () =>
        HttpResponse.json({
          ultimoTipo: 'PAUSA_INICIO',
          ultimoMomento: '2026-01-15T12:00:00Z',
          proximasOpcoes: ['SAIDA', 'PAUSA_FIM'],
        }),
      ),
    )

    renderPontoWidget()

    expect(await screen.findByRole('button', { name: 'Voltar ao trabalho' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Encerrar trabalho' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pausar' })).not.toBeInTheDocument()
    const botoes = screen.getAllByRole('button').map((botao) => botao.textContent)
    expect(botoes).toEqual(['Voltar ao trabalho', 'Encerrar trabalho'])
  })

  it('clicar em pausar troca o botão pra voltar ao trabalho, mantendo o encerrar', async () => {
    let ultimoTipo = 'ENTRADA'
    server.use(
      http.get('/ponto/estado-atual', () =>
        HttpResponse.json({
          ultimoTipo,
          ultimoMomento: '2026-01-15T12:00:00Z',
          proximasOpcoes: ultimoTipo === 'ENTRADA' ? ['SAIDA', 'PAUSA_INICIO'] : ['SAIDA', 'PAUSA_FIM'],
        }),
      ),
      http.post('/ponto/marcar', async ({ request }) => {
        const corpo = (await request.json()) as { tipo: string }
        ultimoTipo = corpo.tipo
        return HttpResponse.json(
          { id: 1, tipo: corpo.tipo, momento: '2026-01-15T12:10:00Z', origem: 'WEB' },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderPontoWidget()

    await user.click(await screen.findByRole('button', { name: 'Pausar' }))

    expect(await screen.findByRole('button', { name: 'Voltar ao trabalho' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Encerrar trabalho' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pausar' })).not.toBeInTheDocument()
  })

  it('clicar em encerrar trabalho volta pro botão único de iniciar trabalho', async () => {
    let ultimoTipo: string | null = 'ENTRADA'
    server.use(
      http.get('/ponto/estado-atual', () =>
        HttpResponse.json({
          ultimoTipo,
          ultimoMomento: ultimoTipo === null ? null : '2026-01-15T12:00:00Z',
          proximasOpcoes: ultimoTipo === 'ENTRADA' ? ['SAIDA', 'PAUSA_INICIO'] : ['ENTRADA'],
        }),
      ),
      http.post('/ponto/marcar', async ({ request }) => {
        const corpo = (await request.json()) as { tipo: string }
        ultimoTipo = corpo.tipo
        return HttpResponse.json(
          { id: 1, tipo: corpo.tipo, momento: '2026-01-15T12:10:00Z', origem: 'WEB' },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderPontoWidget()

    await user.click(await screen.findByRole('button', { name: 'Encerrar trabalho' }))

    expect(await screen.findByRole('button', { name: 'Iniciar trabalho' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pausar' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Encerrar trabalho' })).not.toBeInTheDocument()
  })

  it('quem está em pausa consegue encerrar direto, sem precisar voltar primeiro', async () => {
    let ultimoTipo = 'PAUSA_INICIO'
    server.use(
      http.get('/ponto/estado-atual', () =>
        HttpResponse.json({
          ultimoTipo,
          ultimoMomento: '2026-01-15T12:00:00Z',
          proximasOpcoes: ultimoTipo === 'PAUSA_INICIO' ? ['SAIDA', 'PAUSA_FIM'] : ['ENTRADA'],
        }),
      ),
      http.post('/ponto/marcar', async ({ request }) => {
        const corpo = (await request.json()) as { tipo: string }
        ultimoTipo = corpo.tipo
        return HttpResponse.json(
          { id: 1, tipo: corpo.tipo, momento: '2026-01-15T12:10:00Z', origem: 'WEB' },
          { status: 201 },
        )
      }),
    )
    const user = userEvent.setup()
    renderPontoWidget()

    await user.click(await screen.findByRole('button', { name: 'Encerrar trabalho' }))

    expect(await screen.findByRole('button', { name: 'Iniciar trabalho' })).toBeInTheDocument()
  })
})
