import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { EscritorioPage } from './EscritorioPage'

/**
 * O mundo (piso/paredes/móveis/avatares) virou um canvas Pixi (`CamadaMundo`, redesign estilo
 * Gather) - jsdom não tem um contexto 2D de canvas de verdade, então deixar o Pixi tentar
 * inicializar de verdade aqui só gera ruído (rejeições assíncronas não tratadas) sem testar nada
 * de útil. A fidelidade visual do mundo é verificada via Playwright num navegador real (mesmo
 * método usado em toda a sessão), não aqui - estes testes continuam cobrindo o que sempre
 * cobriram: o HUD ao redor (dock, painéis, lista de presença) e a integração de
 * movimento/status via WebSocket (a lógica pura de posição está em `mundo/movimento.test.ts`).
 */
vi.mock('./mundo/CamadaMundo', () => ({
  CamadaMundo: () => <div data-testid="mundo-canvas-host" />,
}))

/** Ponto aberto de propósito, pra `SugestaoRegistrarEntrada` (S6.11) não interferir nestes testes. */
function handlerPontoAberto() {
  return http.get('/ponto/estado-atual', () => HttpResponse.json({ ultimoTipo: 'ENTRADA', proximasOpcoes: ['PAUSA_INICIO', 'SAIDA'] }))
}

/** `HealthStatus` (S6, reskin "uma tela só") agora mora dentro de `EscritorioPage`. */
function handlerHealthOk() {
  return http.get('/health', () => HttpResponse.json({ status: 'UP' }))
}

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
      <MemoryRouter>
        <EscritorioPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('EscritorioPage', () => {
  it('renderiza o mapa (mundo Pixi) depois de carregar os dados da API', async () => {
    server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)), handlerPontoAberto(), handlerHealthOk())

    renderPagina()

    expect(await screen.findByTestId('mundo-canvas-host')).toBeInTheDocument()
  })

  it('seta pressionada manda a posição do próprio jogador pro servidor, sem esperar resposta', async () => {
    server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)), handlerPontoAberto(), handlerHealthOk())
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 5, y: 5, status: 'DISPONIVEL' }],
      })
    })

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    // nenhuma resposta do servidor foi simulada - a mensagem já sai só com a predição local
    // (a lógica de clamp/próxima posição em si é testada pura em mundo/movimento.test.ts)
    await waitFor(() => {
      expect(WebSocketFalso.instancias[0].mensagensEnviadas).toContain(JSON.stringify({ tipo: 'POSICAO', x: 6, y: 5 }))
    })
  })

  it('trocar o status no seletor manda a mudança pro servidor', async () => {
    server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)), handlerPontoAberto(), handlerHealthOk())
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 5, y: 5, status: 'DISPONIVEL' }],
      })
    })

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'FOCO' } })

    await waitFor(() => {
      expect(WebSocketFalso.instancias[0].mensagensEnviadas).toContain(JSON.stringify({ tipo: 'STATUS', status: 'FOCO' }))
    })
  })

  it('não manda o jogador pra fora dos limites do mapa ao mover na borda', async () => {
    server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)), handlerPontoAberto(), handlerHealthOk())
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' }],
      })
    })

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    fireEvent.keyDown(window, { key: 'ArrowUp' })

    await waitFor(() => {
      expect(WebSocketFalso.instancias[0].mensagensEnviadas).toContain(JSON.stringify({ tipo: 'POSICAO', x: 0, y: 0 }))
    })
  })

  it('a lista de presença reflete entrar/sair de zona e troca de status sem reload', async () => {
    server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)), handlerPontoAberto(), handlerHealthOk())
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    // lista de presença agora é um drawer recolhível (Fase 4), fechado por padrão
    fireEvent.click(screen.getByRole('button', { name: 'Participantes' }))

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 8, y: 8, status: 'DISPONIVEL' }],
      })
    })
    await waitFor(() => {
      expect(screen.getByTestId('presenca-zona-aberto')).toHaveTextContent('Ana')
    })
    expect(screen.getByTestId('presenca-zona-10')).not.toHaveTextContent('Ana')

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'POSICAO',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 1, y: 1, status: 'FOCO' }],
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('presenca-zona-10')).toHaveTextContent('Ana')
      expect(screen.getByTestId('presenca-zona-10')).toHaveTextContent('Trabalhando')
    })
    expect(screen.getByTestId('presenca-zona-aberto')).not.toHaveTextContent('Ana')
  })

  it('abrir o painel de ponto pelo dock mostra o widget de ponto, sem sair da tela', async () => {
    server.use(
      http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)),
      handlerPontoAberto(),
      handlerHealthOk(),
      http.get('/ponto/jornada-do-dia', () =>
        HttpResponse.json({ data: '2026-08-30', estado: 'ABERTA', minutosTrabalhados: 0, saldoDia: 0, saldoAcumuladoNoPeriodo: 0, totalApontadoMinutos: 0 }),
      ),
      http.get('/ponto/espelho-do-mes', () => HttpResponse.json({ dias: [], saldoAcumuladoNoPeriodo: 0 })),
    )
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    fireEvent.click(screen.getByRole('button', { name: /Ponto/ }))

    expect(await screen.findByRole('dialog', { name: /Ponto/ })).toBeInTheDocument()
    // ponto aberto (ENTRADA) - PontoWidget deve oferecer pausa/saída, não "Entrada" de novo
    expect(await screen.findByRole('button', { name: 'Saída' })).toBeInTheDocument()
  })

  it('fecha o painel ao clicar em Fechar', async () => {
    server.use(
      http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)),
      handlerPontoAberto(),
      handlerHealthOk(),
      http.get('/ponto/jornada-do-dia', () =>
        HttpResponse.json({ data: '2026-08-30', estado: 'ABERTA', minutosTrabalhados: 0, saldoDia: 0, saldoAcumuladoNoPeriodo: 0, totalApontadoMinutos: 0 }),
      ),
      http.get('/ponto/espelho-do-mes', () => HttpResponse.json({ dias: [], saldoAcumuladoNoPeriodo: 0 })),
    )
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    fireEvent.click(screen.getByRole('button', { name: /Ponto/ }))
    await screen.findByRole('dialog', { name: /Ponto/ })

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('clicar no aviso de registrar entrada abre o painel de ponto', async () => {
    server.use(
      http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)),
      http.get('/ponto/estado-atual', () => HttpResponse.json({ ultimoTipo: null, proximasOpcoes: ['ENTRADA'] })),
      handlerHealthOk(),
      http.get('/ponto/jornada-do-dia', () =>
        HttpResponse.json({ data: '2026-08-30', estado: 'ABERTA', minutosTrabalhados: 0, saldoDia: 0, saldoAcumuladoNoPeriodo: 0, totalApontadoMinutos: 0 }),
      ),
      http.get('/ponto/espelho-do-mes', () => HttpResponse.json({ dias: [], saldoAcumuladoNoPeriodo: 0 })),
    )
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    fireEvent.click(await screen.findByRole('button', { name: 'Ir pra tela de ponto' }))

    expect(await screen.findByRole('dialog', { name: /Ponto/ })).toBeInTheDocument()
  })

  it('mostra erro quando não há mapa ativo', async () => {
    server.use(http.get('/mapas/ativo', () => new HttpResponse(null, { status: 404 })))

    renderPagina()

    expect(await screen.findByText('Não foi possível carregar o mapa.')).toBeInTheDocument()
  })
})
