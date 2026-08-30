import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { EscritorioPage } from './EscritorioPage'

function base64UrlEncode(json: object): string {
  const base64 = btoa(JSON.stringify(json))
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function tokenFalsoCom(sub: string): string {
  const header = base64UrlEncode({ alg: 'HS512' })
  const corpo = base64UrlEncode({ sub, papel: 'COLABORADOR', exp: 1999999999 })
  return `${header}.${corpo}.assinatura-nao-importa-aqui`
}

const TOKEN_USUARIO_1 = tokenFalsoCom('1')

/** jsdom não implementa WebSocket de verdade - mesma filosofia de `usePresencaWebSocket.test.tsx`. */
class WebSocketFalso {
  static instancias: WebSocketFalso[] = []

  url: string
  onmessage: ((evento: MessageEvent) => void) | null = null
  onclose: (() => void) | null = null
  mensagensEnviadas: string[] = []

  constructor(url: string) {
    this.url = url
    WebSocketFalso.instancias.push(this)
  }

  send(payload: string) {
    this.mensagensEnviadas.push(payload)
  }

  close() {
    this.onclose?.()
  }

  disparaMensagem(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent)
  }
}

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
  useAuthStore.getState().definirSessao(TOKEN_USUARIO_1, 'COLABORADOR')
  WebSocketFalso.instancias = []
  vi.stubGlobal('WebSocket', WebSocketFalso)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const MAPA_ATIVO = {
  id: 1,
  nome: 'Escritório',
  larguraTiles: 20,
  alturaTiles: 15,
  layoutJson: '{"paredes":[]}',
  zonas: [{ id: 10, nome: 'Sala de foco', x: 0, y: 0, largura: 4, altura: 4, tipo: 'FOCO' }],
}

function renderPagina() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <EscritorioPage />
    </QueryClientProvider>,
  )
}

describe('EscritorioPage', () => {
  it('renderiza o mapa e as zonas retornadas pela API', async () => {
    server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)))

    renderPagina()

    expect(await screen.findByText('Escritório')).toBeInTheDocument()
    expect(screen.getByTestId('zona-10')).toHaveTextContent('Sala de foco')
  })

  it('seta pressionada move o próprio avatar localmente de imediato, sem esperar resposta do servidor', async () => {
    server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)))
    renderPagina()
    await screen.findByText('Escritório')

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 5, y: 5, status: 'DISPONIVEL' }],
      })
    })
    await waitFor(() => expect(screen.getByTestId('avatar-1')).toBeInTheDocument())

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    await waitFor(() => {
      expect(screen.getByTestId('avatar-1')).toHaveStyle({ left: '192px', top: '160px' }); // (6*32, 5*32)
    })
    // nenhuma resposta do servidor foi simulada - a posição já mudou só com a predição local
    expect(WebSocketFalso.instancias[0].mensagensEnviadas).toContain(JSON.stringify({ tipo: 'POSICAO', x: 6, y: 5 }))
  })

  it('trocar o status no seletor atualiza o próprio avatar e manda a mudança pro servidor', async () => {
    server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)))
    renderPagina()
    await screen.findByText('Escritório')

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 5, y: 5, status: 'DISPONIVEL' }],
      })
    })
    await waitFor(() => expect(screen.getByTestId('avatar-1')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'FOCO' } })

    await waitFor(() => {
      expect(screen.getByTestId('avatar-1')).toHaveAttribute('title', 'Ana - Foco')
    })
    expect(WebSocketFalso.instancias[0].mensagensEnviadas).toContain(JSON.stringify({ tipo: 'STATUS', status: 'FOCO' }))
  })

  it('não deixa o avatar sair dos limites do mapa ao mover na borda', async () => {
    server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)))
    renderPagina()
    await screen.findByText('Escritório')

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' }],
      })
    })
    await waitFor(() => expect(screen.getByTestId('avatar-1')).toBeInTheDocument())

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'ArrowUp' })

    await waitFor(() => {
      expect(screen.getByTestId('avatar-1')).toHaveStyle({ left: '0px', top: '0px' });
    })
  })

  it('mostra erro quando não há mapa ativo', async () => {
    server.use(http.get('/mapas/ativo', () => new HttpResponse(null, { status: 404 })))

    renderPagina()

    expect(await screen.findByText('Não foi possível carregar o mapa.')).toBeInTheDocument()
  })
})
