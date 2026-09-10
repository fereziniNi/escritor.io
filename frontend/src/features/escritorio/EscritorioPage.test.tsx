import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { setupServer } from 'msw/node'
import { MemoryRouter } from 'react-router'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { dataDeHoje } from '../escala/datasEscala'
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

/** Pedido do usuário: "notificações... reproduzir algum barulho e exibir algo para o usuário
 * perceber" - `alertar`/`pedirPermissaoDeNotificacao`/`atualizarContadorNaoLidas` usam APIs de
 * navegador (Web Audio, Notification, `document.title`) que o jsdom não implementa/não vale a pena
 * exercitar aqui; mockadas pra só verificar QUANDO/COM QUE conteúdo `EscritorioPage` chama, sem
 * precisar de nenhuma delas de verdade (isso é testado à parte em `alertaPerceptivel.test.ts`). */
const alertarMock = vi.fn()
const pedirPermissaoDeNotificacaoMock = vi.fn()
const atualizarContadorNaoLidasMock = vi.fn()
vi.mock('./ui/alertaPerceptivel', () => ({
  alertar: (...args: unknown[]) => alertarMock(...args),
  pedirPermissaoDeNotificacao: () => pedirPermissaoDeNotificacaoMock(),
  atualizarContadorNaoLidas: (...args: unknown[]) => atualizarContadorNaoLidasMock(...args),
}))

/** `CronometroTrabalho` (canto superior direito) bate em `/ponto/estado-atual` em toda
 * renderização da página, não só quando o painel de Ponto está aberto - por isso esse handler entra
 * em praticamente todo teste, mesmo os que não mexem com ponto. */
function handlerPontoAberto() {
  return http.get('/ponto/estado-atual', () =>
    HttpResponse.json({
      ultimoTipo: 'ENTRADA',
      ultimoMomento: '2026-08-30T08:00:00Z',
      segundosTrabalhadosAteAgora: 1800,
      proximasOpcoes: ['PAUSA_INICIO', 'SAIDA'],
    }),
  )
}

/** `HealthStatus` (S6, reskin "uma tela só") agora mora dentro de `EscritorioPage`. */
function handlerHealthOk() {
  return http.get('/health', () => HttpResponse.json({ status: 'UP' }))
}

/** `JornadaPainel` (dentro do painel de Ponto aberto) busca isso agora pra listar o tempo por
 * tarefa hoje - só entra nos testes que abrem o painel. */
function handlerSemApontamentoPorCard() {
  return http.get('/apontamentos', () => HttpResponse.json([]))
}

/** Só `JornadaPainel` (dentro do painel de Ponto aberto) usa isso - `CronometroTrabalho` não. */
function handlerJornadaVazia() {
  return http.get('/ponto/jornada-do-dia', () =>
    HttpResponse.json({ data: '2026-08-30', estado: 'ABERTA', minutosTrabalhados: 0, saldoDia: 0, saldoAcumuladoNoPeriodo: 0, totalApontadoMinutos: 0 }),
  )
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

/** jsdom não implementa `RTCPeerConnection`/Web Audio - fake mínimo só pra confirmar que o clique
 * no mic dispara a sinalização de verdade (o WebRTC em si é testado em `useVozProximidade.test.ts`
 * e ao vivo via Playwright). */
class RTCPeerConnectionFalsa {
  onicecandidate: (() => void) | null = null
  ontrack: (() => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  connectionState = 'new'
  signalingState = 'stable'
  addTransceiver() {
    return { direction: 'recvonly', sender: { track: null, replaceTrack: async () => {} } }
  }
  async createOffer() {
    return { type: 'offer' as const, sdp: 'oferta-falsa' }
  }
  async createAnswer() {
    return { type: 'answer' as const, sdp: 'resposta-falsa' }
  }
  async setLocalDescription() {}
  async setRemoteDescription() {}
  async addIceCandidate() {}
  close() {}
}

class AudioContextFalso {
  createAnalyser() {
    return { fftSize: 512, getByteTimeDomainData: (buffer: Uint8Array) => buffer.fill(128) }
  }
  createMediaStreamSource() {
    return { connect: () => {} }
  }
}

const getUserMediaMock = vi.fn()

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
  vi.stubGlobal('RTCPeerConnection', RTCPeerConnectionFalsa)
  vi.stubGlobal('AudioContext', AudioContextFalso)
  getUserMediaMock.mockReset().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }], getAudioTracks: () => [{ stop: vi.fn() }] })
  Object.defineProperty(navigator, 'mediaDevices', { value: { getUserMedia: getUserMediaMock }, configurable: true })
  alertarMock.mockClear()
  pedirPermissaoDeNotificacaoMock.mockClear()
  atualizarContadorNaoLidasMock.mockClear()
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

  describe('pedido do usuário: "cabines... devem ter paredes e só é possível entrar por um lado"', () => {
    // Cabine 3×3 em (10,10) - porta gerada por `gerarParedesDeZona(zonas, 'leste')` (fixo em
    // EscritorioPage.tsx) abre o vão no meio da borda leste: antesDaPorta=floor((3-2)/2)=0,
    // então o vão cobre as 2 primeiras linhas (y=10,11) - só (12,12) continua com parede (pedido
    // do usuário: "aumente o tamanho da porta", vão de 2 tiles agora, era 1).
    const MAPA_COM_CABINE = {
      ...MAPA_ATIVO,
      zonas: [{ id: 20, nome: 'Cabine 1', x: 10, y: 10, largura: 3, altura: 3, tipo: 'CABINE' }],
    }

    it('a parede sem porta bloqueia o movimento de verdade', async () => {
      server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_COM_CABINE)), handlerPontoAberto(), handlerHealthOk())
      renderPagina()
      await screen.findByTestId('mundo-canvas-host')

      act(() => {
        WebSocketFalso.instancias[0].disparaMensagem({
          tipo: 'SNAPSHOT',
          usuarios: [{ usuarioId: 1, nome: 'Ana', x: 12, y: 12, status: 'DISPONIVEL' }], // encostada na parede leste, fora da porta
        })
      })

      fireEvent.keyDown(window, { key: 'ArrowRight' }) // tentaria ir pra (13,12) - bloqueado

      await waitFor(() => {
        expect(WebSocketFalso.instancias[0].mensagensEnviadas).toContain(JSON.stringify({ tipo: 'POSICAO', x: 12, y: 12 }))
      })
      expect(WebSocketFalso.instancias[0].mensagensEnviadas).not.toContain(JSON.stringify({ tipo: 'POSICAO', x: 13, y: 12 }))
    })

    it('o vão da porta deixa passar', async () => {
      server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_COM_CABINE)), handlerPontoAberto(), handlerHealthOk())
      renderPagina()
      await screen.findByTestId('mundo-canvas-host')

      act(() => {
        WebSocketFalso.instancias[0].disparaMensagem({
          tipo: 'SNAPSHOT',
          usuarios: [{ usuarioId: 1, nome: 'Ana', x: 12, y: 11, status: 'DISPONIVEL' }], // alinhada com o vão da porta
        })
      })

      fireEvent.keyDown(window, { key: 'ArrowRight' }) // vai pra (13,11) - passa pela porta

      await waitFor(() => {
        expect(WebSocketFalso.instancias[0].mensagensEnviadas).toContain(JSON.stringify({ tipo: 'POSICAO', x: 13, y: 11 }))
      })
    })

    it('pedido do usuário: "a tela do mapa (apenas do mapa) fica mais escura" - escurece só ao entrar na cabine', async () => {
      server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_COM_CABINE)), handlerPontoAberto(), handlerHealthOk())
      renderPagina()
      await screen.findByTestId('mundo-canvas-host')

      expect(screen.queryByTestId('mapa-escurecido')).not.toBeInTheDocument()

      act(() => {
        WebSocketFalso.instancias[0].disparaMensagem({
          tipo: 'SNAPSHOT',
          usuarios: [{ usuarioId: 1, nome: 'Ana', x: 11, y: 11, status: 'DISPONIVEL' }], // dentro da cabine
        })
      })

      expect(await screen.findByTestId('mapa-escurecido')).toBeInTheDocument()

      act(() => {
        WebSocketFalso.instancias[0].disparaMensagem({
          tipo: 'SNAPSHOT',
          usuarios: [{ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' }], // fora da cabine de novo
        })
      })

      await waitFor(() => expect(screen.queryByTestId('mapa-escurecido')).not.toBeInTheDocument())
    })

    it('pedido do usuário: "Apenas uma pessoa deve entrar na cabine, Capacidade de 1 pessoa por cabine" - a porta some pra quem já tem gente dentro', async () => {
      server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_COM_CABINE)), handlerPontoAberto(), handlerHealthOk())
      renderPagina()
      await screen.findByTestId('mundo-canvas-host')

      act(() => {
        WebSocketFalso.instancias[0].disparaMensagem({
          tipo: 'SNAPSHOT',
          usuarios: [
            { usuarioId: 1, nome: 'Ana', x: 13, y: 11, status: 'DISPONIVEL' }, // eu, bem na porta
            { usuarioId: 2, nome: 'Beto', x: 11, y: 11, status: 'DISPONIVEL' }, // já dentro da cabine
          ],
        })
      })

      fireEvent.keyDown(window, { key: 'ArrowLeft' }) // tentaria ir pra (12,11) - vão da porta, mas ocupada

      await waitFor(() => {
        expect(WebSocketFalso.instancias[0].mensagensEnviadas).toContain(JSON.stringify({ tipo: 'POSICAO', x: 13, y: 11 }))
      })
      expect(WebSocketFalso.instancias[0].mensagensEnviadas).not.toContain(JSON.stringify({ tipo: 'POSICAO', x: 12, y: 11 }))

      // Beto sai da cabine - agora a porta libera de novo.
      act(() => {
        WebSocketFalso.instancias[0].disparaMensagem({
          tipo: 'SNAPSHOT',
          usuarios: [
            { usuarioId: 1, nome: 'Ana', x: 13, y: 11, status: 'DISPONIVEL' },
            { usuarioId: 2, nome: 'Beto', x: 0, y: 0, status: 'DISPONIVEL' },
          ],
        })
      })

      fireEvent.keyDown(window, { key: 'ArrowLeft' })

      await waitFor(() => {
        expect(WebSocketFalso.instancias[0].mensagensEnviadas).toContain(JSON.stringify({ tipo: 'POSICAO', x: 12, y: 11 }))
      })
    })
  })

  describe('pedido do usuário: "coloque parede em todas [as áreas]"', () => {
    // FOCO 4×4 em (10,10) - `BORDA_PORTA_POR_TIPO.FOCO` é 'norte': antesDaPorta=floor((4-1)/2)=1,
    // vão no meio da borda norte fica em x=11 (a parede em x=10/y=9 continua fechada).
    const MAPA_COM_SALA = {
      ...MAPA_ATIVO,
      zonas: [{ id: 21, nome: 'Área de trabalho', x: 10, y: 10, largura: 4, altura: 4, tipo: 'FOCO' }],
    }

    it('não é mais só a cabine - qualquer sala ganha parede de verdade', async () => {
      server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_COM_SALA)), handlerPontoAberto(), handlerHealthOk())
      renderPagina()
      await screen.findByTestId('mundo-canvas-host')

      act(() => {
        WebSocketFalso.instancias[0].disparaMensagem({
          tipo: 'SNAPSHOT',
          usuarios: [{ usuarioId: 1, nome: 'Ana', x: 10, y: 11, status: 'DISPONIVEL' }], // dentro, encostada na parede oeste
        })
      })

      fireEvent.keyDown(window, { key: 'ArrowLeft' }) // tentaria ir pra (9,11) - bloqueado, sem porta nessa borda

      await waitFor(() => {
        expect(WebSocketFalso.instancias[0].mensagensEnviadas).toContain(JSON.stringify({ tipo: 'POSICAO', x: 10, y: 11 }))
      })
      expect(WebSocketFalso.instancias[0].mensagensEnviadas).not.toContain(JSON.stringify({ tipo: 'POSICAO', x: 9, y: 11 }))
    })

    it('a porta de cada tipo de sala abre pra borda certa (FOCO: norte)', async () => {
      server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_COM_SALA)), handlerPontoAberto(), handlerHealthOk())
      renderPagina()
      await screen.findByTestId('mundo-canvas-host')

      act(() => {
        WebSocketFalso.instancias[0].disparaMensagem({
          tipo: 'SNAPSHOT',
          usuarios: [{ usuarioId: 1, nome: 'Ana', x: 11, y: 9, status: 'DISPONIVEL' }], // fora, alinhada com o vão da porta norte
        })
      })

      fireEvent.keyDown(window, { key: 'ArrowDown' }) // vai pra (11,10) - passa pela porta

      await waitFor(() => {
        expect(WebSocketFalso.instancias[0].mensagensEnviadas).toContain(JSON.stringify({ tipo: 'POSICAO', x: 11, y: 10 }))
      })
    })
  })

  it('volta da Google com "?google=conectado" mostra o toast, abre "Configurações pessoais" e limpa a URL', async () => {
    server.use(
      http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)),
      handlerPontoAberto(),
      handlerHealthOk(),
      http.get('/escala/semanal', () => HttpResponse.json([])),
      http.get('/escala/efetiva', () => HttpResponse.json([])),
      http.get('/escala/excecoes', () => HttpResponse.json([])),
      http.get('/integracoes/google/estado', () => HttpResponse.json({ habilitado: true, conectado: true })),
    )
    window.history.pushState({}, '', '/?google=conectado')

    renderPagina()

    expect(await screen.findByText(/google agenda conectado/i)).toBeInTheDocument()
    expect(await screen.findByRole('dialog', { name: /configurações pessoais/i })).toBeInTheDocument()
    // abre direto na aba "Minha escala" (foi lá que a conexão com a Google foi iniciada)
    expect(screen.getByRole('tab', { name: /minha escala/i, selected: true })).toBeInTheDocument()
    expect(window.location.search).toBe('')
  })

  it('abrir o painel de ponto pelo dock mostra o widget de ponto, sem sair da tela', async () => {
    server.use(
      http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)),
      handlerPontoAberto(),
      handlerHealthOk(),
      handlerJornadaVazia(),
      handlerSemApontamentoPorCard(),
      http.get('/ponto/espelho-do-mes', () => HttpResponse.json({ dias: [], saldoAcumuladoNoPeriodo: 0 })),
    )
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    fireEvent.click(screen.getByRole('button', { name: /Ponto/ }))

    expect(await screen.findByRole('dialog', { name: /Ponto/ })).toBeInTheDocument()
    // ponto aberto (ENTRADA) - PontoWidget oferece Pausar e Encerrar trabalho
    expect(await screen.findByRole('button', { name: 'Pausar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Encerrar trabalho' })).toBeInTheDocument()
  })

  it('abre "Configurações pessoais" com abas diferentes dependendo de como foi aberto', async () => {
    // pedido do usuário: "Esse agenda pessoal deve estar em configurações pessoais, ali a pessoa
    // pode editar até o personagem também e outras coisas" - botão da barra de ferramentas abre
    // direto na aba "Minha escala"; clicar na própria bolha de avatar abre direto em "Personagem".
    server.use(
      http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)),
      handlerPontoAberto(),
      handlerHealthOk(),
      http.get('/escala/semanal', () => HttpResponse.json([])),
      http.get('/escala/efetiva', () => HttpResponse.json([])),
      http.get('/escala/excecoes', () => HttpResponse.json([])),
      http.get('/escala/reunioes', () => HttpResponse.json([])),
      http.get('/integracoes/google/estado', () => HttpResponse.json({ habilitado: false, conectado: false })),
      http.get('/usuarios/me', () => HttpResponse.json({ id: 1, nome: 'Ana Souza', aparencia: {} })),
    )
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    fireEvent.click(screen.getByRole('button', { name: 'Configurações pessoais' }))
    expect(await screen.findByRole('dialog', { name: /configurações pessoais/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /minha escala/i, selected: true })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    fireEvent.click(screen.getByRole('button', { name: 'Editar avatar' }))

    expect(await screen.findByRole('dialog', { name: /configurações pessoais/i })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /personagem/i, selected: true })).toBeInTheDocument()
  })

  it('qualquer papel abre "Reuniões" pelo dock', async () => {
    // pedido do usuário: "onde o usuário do sistema (independente) vai conseguir marcar e entrar
    // nas reuniões do meet" - deixou de ser GESTOR/ADMIN só.
    server.use(
      http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)),
      handlerPontoAberto(),
      handlerHealthOk(),
      http.get('/integracoes/google/estado', () => HttpResponse.json({ habilitado: false, conectado: false })),
    )
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    fireEvent.click(await screen.findByRole('button', { name: 'Reuniões' }))

    expect(await screen.findByRole('dialog', { name: /reuniões/i })).toBeInTheDocument()
  })

  it('mostra o mini chat sempre montado no canto superior esquerdo, com a conversa Geral na lista', async () => {
    // pedido do usuário: "eu quero que voce deixe um mini chat aberto na lateral esquerda no
    // topo, igual ao tempo mas do lado esquerdo... igual ao whats, mas em miniatura igual um
    // popup" - sempre visível (não depende de mensagem não lida, não é mais um botão do dock).
    // Comportamento detalhado (navegar entre lista/nova conversa/thread, enviar mensagem etc.) é
    // coberto em `ChatMiniWidget.test.tsx` - aqui só confirma que o widget está de fato montado.
    server.use(
      http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)),
      handlerPontoAberto(),
      handlerHealthOk(),
      http.get('/chat/conversas', () =>
        HttpResponse.json([{ id: 1, tipo: 'GERAL', nome: 'Geral', ultimaMensagem: null, naoLidas: 0 }]),
      ),
    )
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    expect(screen.queryByRole('button', { name: /^chat$/i })).not.toBeInTheDocument()
    expect(await screen.findByText('💬 Chat')).toBeInTheDocument()
    expect(await screen.findByText('Geral')).toBeInTheDocument()
  })

  it('"Entrar na sala do escritório" muda o status pra Reunião, teleporta pra sala e fecha o painel', async () => {
    // pedido do usuário (sessão anterior): "onde está o link da reunião para eu entrar? Preciso
    // entrar no google?" - reaproveita o status "Reunião" já existente (teleporta o personagem pra
    // Sala de Reunião do mapa via `calcularDestinoParaStatus`) e fecha o painel flutuante. Esse
    // botão fica no detalhe de uma reunião na agenda pessoal (`EscalaCalendarioPainel`, dentro de
    // "Configurações pessoais" > "Minha escala"), não mais dentro do painel "Reuniões".
    const mapaComSalaDeReuniao = {
      ...MAPA_ATIVO,
      zonas: [...MAPA_ATIVO.zonas, { id: 11, nome: 'Sala de reunião', x: 10, y: 10, largura: 1, altura: 1, tipo: 'REUNIAO' }],
    }
    server.use(
      http.get('/mapas/ativo', () => HttpResponse.json(mapaComSalaDeReuniao)),
      handlerPontoAberto(),
      handlerHealthOk(),
      http.get('/escala/semanal', () => HttpResponse.json([])),
      http.get('/escala/efetiva', () =>
        HttpResponse.json([{ data: dataDeHoje(), trabalha: true, horaInicio: '09:00:00', horaFim: '18:00:00' }]),
      ),
      http.get('/escala/excecoes', () => HttpResponse.json([])),
      http.get('/escala/reunioes', () =>
        HttpResponse.json([
          {
            id: 1,
            criadorId: 2,
            criadorNome: 'Chefe',
            participantes: [{ id: 1, nome: 'Ana' }],
            data: dataDeHoje(),
            horaInicio: '14:30:00',
            horaFim: '15:00:00',
            titulo: 'Alinhamento',
            linkMeet: 'https://meet.google.com/abc-defg-hij',
          },
        ]),
      ),
      http.get('/integracoes/google/estado', () => HttpResponse.json({ habilitado: false, conectado: false })),
    )
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    fireEvent.click(await screen.findByRole('button', { name: 'Configurações pessoais' }))
    const dialogo = await screen.findByRole('dialog', { name: /configurações pessoais/i })
    fireEvent.click(await within(dialogo).findByRole('tab', { name: 'Dia' }))
    fireEvent.click(await within(dialogo).findByText(/Alinhamento/))

    fireEvent.click(await within(dialogo).findByRole('button', { name: /entrar na sala do escritório/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(WebSocketFalso.instancias[0].mensagensEnviadas).toContain(JSON.stringify({ tipo: 'STATUS', status: 'REUNIAO' }))
    expect(WebSocketFalso.instancias[0].mensagensEnviadas).toContain(JSON.stringify({ tipo: 'POSICAO', x: 10, y: 10 }))
  })

  it('fecha o painel ao clicar em Fechar', async () => {
    server.use(
      http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)),
      handlerPontoAberto(),
      handlerHealthOk(),
      handlerJornadaVazia(),
      handlerSemApontamentoPorCard(),
      http.get('/ponto/espelho-do-mes', () => HttpResponse.json({ dias: [], saldoAcumuladoNoPeriodo: 0 })),
    )
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    fireEvent.click(screen.getByRole('button', { name: /Ponto/ }))
    await screen.findByRole('dialog', { name: /Ponto/ })

    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('mostra erro quando não há mapa ativo', async () => {
    server.use(http.get('/mapas/ativo', () => new HttpResponse(null, { status: 404 })))

    renderPagina()

    expect(await screen.findByText('Não foi possível carregar o mapa.')).toBeInTheDocument()
  })

  // ---------- pedido do usuário: "notificações... barulho e exibir algo... na aba" ----------

  it('pede permissão de notificação ao entrar no escritório', async () => {
    server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)), handlerPontoAberto(), handlerHealthOk())
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    expect(pedirPermissaoDeNotificacaoMock).toHaveBeenCalledTimes(1)
  })

  it('um convite de reunião dispara o alerta perceptível (som + aba), além do toast já existente', async () => {
    server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)), handlerPontoAberto(), handlerHealthOk())
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'CONVITE_REUNIAO',
        reuniaoId: 1,
        titulo: 'Alinhamento',
        criadorNome: 'Beto',
        data: '2026-01-05',
        horaInicio: '14:30:00',
        horaFim: '15:00:00',
        linkMeet: null,
      })
    })

    expect(await screen.findByText(/beto te chamou pra "alinhamento"/i)).toBeInTheDocument()
    await waitFor(() => expect(alertarMock).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Convite de reunião' })))
  })

  it('uma mensagem de chat dispara o alerta perceptível (som + aba), sem toast (o mini chat já mostra o badge)', async () => {
    server.use(
      http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)),
      handlerPontoAberto(),
      handlerHealthOk(),
      http.get('/chat/conversas', () => HttpResponse.json([])),
    )
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'CHAT_MENSAGEM',
        conversaId: 1,
        mensagemId: 900,
        autorId: 2,
        autorNome: 'Beto',
        texto: 'Oi, tudo bem?',
        criadoEm: '2026-01-15T09:00:00Z',
      })
    })

    await waitFor(() =>
      expect(alertarMock).toHaveBeenCalledWith({ titulo: 'Mensagem de Beto', corpo: 'Oi, tudo bem?' }),
    )
  })

  it('uma tarefa concluída mostra um toast e dispara o alerta perceptível', async () => {
    server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)), handlerPontoAberto(), handlerHealthOk())
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'TAREFA_CONCLUIDA',
        cardId: 42,
        cardTitulo: 'Corrigir bug',
        projetoNome: 'Backlog',
        autorNome: 'Beto',
      })
    })

    expect(await screen.findByText(/beto concluiu "corrigir bug" em backlog/i)).toBeInTheDocument()
    await waitFor(() => expect(alertarMock).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Tarefa concluída' })))
  })

  it('uma tarefa nova de qualquer projeto mostra um toast e dispara o alerta perceptível (pedido: "informar todos os usuários")', async () => {
    server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)), handlerPontoAberto(), handlerHealthOk())
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'NOVA_TAREFA',
        cardId: 43,
        cardTitulo: 'Escrever testes',
        projetoNome: 'Backlog',
        autorNome: 'Beto',
      })
    })

    expect(await screen.findByText(/beto criou a tarefa "escrever testes" em backlog/i)).toBeInTheDocument()
    await waitFor(() => expect(alertarMock).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Nova tarefa' })))
  })

  it('pedido do usuário: "algo relacionado à notificação para ver as últimas que chegaram no sistema" - sino mostra o contador e abrir o painel marca tudo como lido', async () => {
    let lida = false
    server.use(
      http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)),
      handlerPontoAberto(),
      handlerHealthOk(),
      http.get('/notificacoes', () =>
        HttpResponse.json({
          itens: [
            {
              id: 1,
              tipo: 'NOVA_TAREFA',
              texto: 'Ana criou a tarefa "Corrigir bug" em Site novo',
              link: null,
              lida,
              criadoEm: '2026-01-15T11:55:00Z',
            },
          ],
          naoLidas: lida ? 0 : 1,
        }),
      ),
      http.post('/notificacoes/marcar-lidas', () => {
        lida = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    expect(await screen.findByRole('button', { name: 'Notificações, 1 não lidas' })).toBeInTheDocument()
    // Pedido do usuário: "a aba mostrasse a quantidade de notificações que não foram lidas" -
    // `EscritorioPage` repassa o contador pro título da aba via `atualizarContadorNaoLidas`
    // (comportamento de verdade testado em `alertaPerceptivel.test.ts`; aqui só confirma que
    // `EscritorioPage` chama com o número certo).
    await waitFor(() => expect(atualizarContadorNaoLidasMock).toHaveBeenCalledWith(1))

    fireEvent.click(screen.getByRole('button', { name: 'Notificações, 1 não lidas' }))

    expect(await screen.findByRole('dialog', { name: /Notificações/ })).toBeInTheDocument()
    expect(await screen.findByText(/Ana criou a tarefa "Corrigir bug" em Site novo/)).toBeInTheDocument()

    // abrir já marca tudo como lido - o contador do sino some sozinho, sem precisar fechar/reabrir.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Notificações' })).toBeInTheDocument())
    await waitFor(() => expect(atualizarContadorNaoLidasMock).toHaveBeenCalledWith(0))
  })

  it('pedido do usuário: "quando a pessoa entra [na sala Happy Hour] aparece um modal pequeno escrito mural" - só aparece dentro da zona', async () => {
    const mapaComHappyHour = {
      ...MAPA_ATIVO,
      zonas: [...MAPA_ATIVO.zonas, { id: 20, nome: 'Happy Hour', x: 10, y: 10, largura: 4, altura: 4, tipo: 'HAPPY_HOUR' }],
    }
    server.use(http.get('/mapas/ativo', () => HttpResponse.json(mapaComHappyHour)), handlerPontoAberto(), handlerHealthOk())
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' }],
      })
    })
    expect(screen.queryByRole('button', { name: /mural do happy hour/i })).not.toBeInTheDocument()

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'POSICAO',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 11, y: 11, status: 'DISPONIVEL' }],
      })
    })
    expect(await screen.findByRole('button', { name: /mural do happy hour/i })).toBeInTheDocument()

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'POSICAO',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' }],
      })
    })
    await waitFor(() => expect(screen.queryByRole('button', { name: /mural do happy hour/i })).not.toBeInTheDocument())
  })

  it('pedido do usuário: "uma parte para roleta onde será sorteado qual atividade" - o resultado avisa todo mundo (toast + alerta perceptível)', async () => {
    server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)), handlerPontoAberto(), handlerHealthOk())
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SORTEIO_HAPPY_HOUR',
        atividadeId: 7,
        descricao: 'Karaokê',
        sorteadoPorNome: 'Beto',
      })
    })

    expect(await screen.findByText(/roleta girou! atividade escolhida: "karaokê"/i)).toBeInTheDocument()
    await waitFor(() => expect(alertarMock).toHaveBeenCalledWith(expect.objectContaining({ titulo: 'Happy Hour' })))
  })

  it('pedido do usuário: "No microfone deve ter o som ligado sempre" - ficar perto de alguém já dispara a sinalização WebRTC, sem precisar ligar o microfone', async () => {
    server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)), handlerPontoAberto(), handlerHealthOk())
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [
          { usuarioId: 1, nome: 'Ana', x: 5, y: 5, status: 'DISPONIVEL' },
          { usuarioId: 2, nome: 'Beto', x: 6, y: 5, status: 'DISPONIVEL' },
        ],
      })
    })

    // nenhum clique no mic - a conexão (pronta pra ouvir) já nasce da proximidade sozinha.
    await waitFor(() => {
      const mensagens = WebSocketFalso.instancias[0].mensagensEnviadas
      expect(mensagens.some((m) => m.includes('"tipo":"RTC_SINAL"') && m.includes('"destinatarioId":2'))).toBe(true)
    })
    expect(getUserMediaMock).not.toHaveBeenCalled()
  })

  it('pedido do usuário: "só o microfone que deve estar disponível para ligar e desligar" - ativar o mic perto de alguém pede o microfone', async () => {
    server.use(http.get('/mapas/ativo', () => HttpResponse.json(MAPA_ATIVO)), handlerPontoAberto(), handlerHealthOk())
    renderPagina()
    await screen.findByTestId('mundo-canvas-host')

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [
          { usuarioId: 1, nome: 'Ana', x: 5, y: 5, status: 'DISPONIVEL' },
          { usuarioId: 2, nome: 'Beto', x: 6, y: 5, status: 'DISPONIVEL' },
        ],
      })
    })

    fireEvent.click(screen.getByRole('button', { name: /ativar microfone/i }))

    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalled())
  })
})
