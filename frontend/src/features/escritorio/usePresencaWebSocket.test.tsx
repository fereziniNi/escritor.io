import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { usePresencaWebSocket } from './usePresencaWebSocket'

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

/** jsdom não implementa WebSocket de verdade - mesma filosofia de `useProjetoWebSocket.test.tsx`. */
class WebSocketFalso {
  static instancias: WebSocketFalso[] = []

  url: string
  onopen: (() => void) | null = null
  onmessage: ((evento: MessageEvent) => void) | null = null
  onclose: (() => void) | null = null
  fechado = false
  mensagensEnviadas: string[] = []

  constructor(url: string) {
    this.url = url
    WebSocketFalso.instancias.push(this)
  }

  send(payload: string) {
    this.mensagensEnviadas.push(payload)
  }

  close() {
    this.fechado = true
    this.onclose?.()
  }

  disparaMensagem(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) } as MessageEvent)
  }

  disparaConexaoAberta() {
    this.onopen?.()
  }

  disparaQuedaDeConexao() {
    this.onclose?.()
  }
}

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
  useAuthStore.getState().definirSessao(TOKEN_USUARIO_1, 'COLABORADOR')
  WebSocketFalso.instancias = []
  vi.stubGlobal('WebSocket', WebSocketFalso)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('usePresencaWebSocket', () => {
  it('conecta em /ws/presenca com o token da sessão', () => {
    renderHook(() => usePresencaWebSocket())

    expect(WebSocketFalso.instancias).toHaveLength(1)
    expect(WebSocketFalso.instancias[0].url).toContain('/ws/presenca')
    expect(WebSocketFalso.instancias[0].url).toContain(`token=${TOKEN_USUARIO_1}`)
  })

  it('expõe o próprio usuarioId decodificado do token', () => {
    const { result } = renderHook(() => usePresencaWebSocket())

    expect(result.current.meuUsuarioId).toBe(1)
  })

  it('aplica um SNAPSHOT recebido no estado de usuários', async () => {
    const { result } = renderHook(() => usePresencaWebSocket())

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [
          { usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' },
          { usuarioId: 2, nome: 'Beto', x: 3, y: 4, status: 'DISPONIVEL' },
        ],
      })
    })

    await waitFor(() => {
      expect(result.current.usuarios[1]).toEqual({ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' })
      expect(result.current.usuarios[2]).toEqual({ usuarioId: 2, nome: 'Beto', x: 3, y: 4, status: 'DISPONIVEL' })
    })
  })

  it('um evento POSICAO atualiza só o usuário movido, sem apagar os demais', async () => {
    const { result } = renderHook(() => usePresencaWebSocket())
    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [
          { usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' },
          { usuarioId: 2, nome: 'Beto', x: 3, y: 4, status: 'DISPONIVEL' },
        ],
      })
    })

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'POSICAO',
        usuarios: [{ usuarioId: 2, nome: 'Beto', x: 5, y: 5, status: 'DISPONIVEL' }],
      })
    })

    await waitFor(() => {
      expect(result.current.usuarios[2]?.x).toBe(5)
      expect(result.current.usuarios[1]?.x).toBe(0)
    })
  })

  it('mover atualiza a própria posição localmente de imediato, antes de qualquer resposta do servidor', async () => {
    const { result } = renderHook(() => usePresencaWebSocket())
    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' }],
      })
    })
    await waitFor(() => expect(result.current.usuarios[1]).toBeDefined())

    act(() => {
      result.current.mover(1, 0)
    })

    expect(result.current.usuarios[1]?.x).toBe(1)
    expect(result.current.usuarios[1]?.y).toBe(0)
  })

  it('mover manda a posição pro servidor', async () => {
    const { result } = renderHook(() => usePresencaWebSocket())
    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' }],
      })
    })
    await waitFor(() => expect(result.current.usuarios[1]).toBeDefined())

    act(() => {
      result.current.mover(1, 0)
    })

    expect(WebSocketFalso.instancias[0].mensagensEnviadas).toContain(JSON.stringify({ tipo: 'POSICAO', x: 1, y: 0 }))
  })

  it('definirStatus atualiza o próprio status localmente de imediato e manda pro servidor', async () => {
    const { result } = renderHook(() => usePresencaWebSocket())
    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' }],
      })
    })
    await waitFor(() => expect(result.current.usuarios[1]).toBeDefined())

    act(() => {
      result.current.definirStatus('FOCO')
    })

    expect(result.current.usuarios[1]?.status).toBe('FOCO')
    expect(WebSocketFalso.instancias[0].mensagensEnviadas).toContain(JSON.stringify({ tipo: 'STATUS', status: 'FOCO' }))
  })

  it('um evento STATUS de outro usuário atualiza só o status dele, sem mexer no meu', async () => {
    const { result } = renderHook(() => usePresencaWebSocket())
    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [
          { usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' },
          { usuarioId: 2, nome: 'Beto', x: 3, y: 4, status: 'DISPONIVEL' },
        ],
      })
    })

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'STATUS',
        usuarios: [{ usuarioId: 2, nome: 'Beto', x: 3, y: 4, status: 'REUNIAO' }],
      })
    })

    await waitFor(() => {
      expect(result.current.usuarios[2]?.status).toBe('REUNIAO')
      expect(result.current.usuarios[1]?.status).toBe('DISPONIVEL')
    })
  })

  it('um CONVITE_REUNIAO vira um item em convitesRecebidos, sem mexer no mapa de usuários', async () => {
    // pedido do usuário: "chamar para reunião pela plataforma" - mensagem própria, não deve ser
    // tratada como STATUS/POSICAO/SNAPSHOT (que sempre esperam `usuarios`).
    const { result } = renderHook(() => usePresencaWebSocket())
    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' }],
      })
    })
    await waitFor(() => expect(result.current.usuarios[1]).toBeDefined())

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'CONVITE_REUNIAO',
        reuniaoId: 42,
        titulo: 'Alinhamento',
        criadorNome: 'Beto',
        data: '2026-01-05',
        horaInicio: '14:30:00',
        horaFim: '15:00:00',
        linkMeet: 'https://meet.google.com/abc-defg-hij',
      })
    })

    await waitFor(() => {
      expect(result.current.convitesRecebidos).toHaveLength(1)
      expect(result.current.convitesRecebidos[0]).toMatchObject({ reuniaoId: 42, titulo: 'Alinhamento', criadorNome: 'Beto' })
    })
    expect(result.current.usuarios[1]).toEqual({ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' })
  })

  it('uma CHAT_MENSAGEM vira um item em mensagensRecebidas, sem mexer no mapa de usuários', async () => {
    // pedido do usuário: "chat... em tempo real... Não deve conter atraso" - mensagem própria,
    // mesma lógica de CONVITE_REUNIAO acima.
    const { result } = renderHook(() => usePresencaWebSocket())
    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' }],
      })
    })
    await waitFor(() => expect(result.current.usuarios[1]).toBeDefined())

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'CHAT_MENSAGEM',
        conversaId: 5,
        mensagemId: 900,
        autorId: 2,
        autorNome: 'Beto',
        texto: 'Oi, tudo bem?',
        criadoEm: '2026-01-15T12:00:00Z',
      })
    })

    await waitFor(() => {
      expect(result.current.mensagensRecebidas).toHaveLength(1)
      expect(result.current.mensagensRecebidas[0]).toMatchObject({ conversaId: 5, mensagemId: 900, texto: 'Oi, tudo bem?' })
    })
    expect(result.current.usuarios[1]).toEqual({ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' })
  })

  it('uma TAREFA_CONCLUIDA vira um item em tarefasConcluidasRecebidas, sem mexer no mapa de usuários', async () => {
    // pedido do usuário: "sempre que alguém finalizar uma tarefa... notificado ao usuário" -
    // mensagem própria, mesma lógica de CONVITE_REUNIAO/CHAT_MENSAGEM acima.
    const { result } = renderHook(() => usePresencaWebSocket())
    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' }],
      })
    })
    await waitFor(() => expect(result.current.usuarios[1]).toBeDefined())

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'TAREFA_CONCLUIDA',
        cardId: 42,
        cardTitulo: 'Corrigir bug',
        projetoNome: 'Backlog',
        autorNome: 'Beto',
      })
    })

    await waitFor(() => {
      expect(result.current.tarefasConcluidasRecebidas).toHaveLength(1)
      expect(result.current.tarefasConcluidasRecebidas[0]).toMatchObject({ cardId: 42, cardTitulo: 'Corrigir bug', autorNome: 'Beto' })
    })
    expect(result.current.usuarios[1]).toEqual({ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' })
  })

  it('uma NOVA_TAREFA vira um item em novasTarefasRecebidas, sem mexer no mapa de usuários', async () => {
    // pedido do usuário: "quando qualquer pessoa adicionar alguma tarefa nova... deve informar
    // todos os usuários do sistema" - mesma lógica de TAREFA_CONCLUIDA acima.
    const { result } = renderHook(() => usePresencaWebSocket())
    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' }],
      })
    })
    await waitFor(() => expect(result.current.usuarios[1]).toBeDefined())

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'NOVA_TAREFA',
        cardId: 43,
        cardTitulo: 'Escrever testes',
        projetoNome: 'Backlog',
        autorNome: 'Beto',
      })
    })

    await waitFor(() => {
      expect(result.current.novasTarefasRecebidas).toHaveLength(1)
      expect(result.current.novasTarefasRecebidas[0]).toMatchObject({ cardId: 43, cardTitulo: 'Escrever testes', autorNome: 'Beto' })
    })
    expect(result.current.usuarios[1]).toEqual({ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' })
  })

  it('um SORTEIO_HAPPY_HOUR vira um item em sorteiosHappyHourRecebidos, sem mexer no mapa de usuários', async () => {
    // pedido do usuário: "uma parte para roleta onde será sorteado qual atividade será feita" -
    // mesma lógica de TAREFA_CONCLUIDA/NOVA_TAREFA acima.
    const { result } = renderHook(() => usePresencaWebSocket())
    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' }],
      })
    })
    await waitFor(() => expect(result.current.usuarios[1]).toBeDefined())

    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SORTEIO_HAPPY_HOUR',
        atividadeId: 7,
        descricao: 'Karaokê',
        sorteadoPorNome: 'Beto',
      })
    })

    await waitFor(() => {
      expect(result.current.sorteiosHappyHourRecebidos).toHaveLength(1)
      expect(result.current.sorteiosHappyHourRecebidos[0]).toMatchObject({ atividadeId: 7, descricao: 'Karaokê', sorteadoPorNome: 'Beto' })
    })
    expect(result.current.usuarios[1]).toEqual({ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' })
  })

  it('reconecta se a conexão cair sem ter sido fechada pelo próprio componente', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    renderHook(() => usePresencaWebSocket())
    expect(WebSocketFalso.instancias).toHaveLength(1)

    WebSocketFalso.instancias[0].disparaQuedaDeConexao()
    await vi.advanceTimersByTimeAsync(5000)

    expect(WebSocketFalso.instancias.length).toBeGreaterThanOrEqual(2)
  })

  it('reconecta com atraso crescente (backoff exponencial) entre quedas sucessivas sem sucesso', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    renderHook(() => usePresencaWebSocket())
    WebSocketFalso.instancias[0].disparaQuedaDeConexao(); // 1ª queda: atraso base (1000ms)

    await vi.advanceTimersByTimeAsync(999)
    expect(WebSocketFalso.instancias).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(WebSocketFalso.instancias).toHaveLength(2)

    WebSocketFalso.instancias[1].disparaQuedaDeConexao(); // nova conexão cai sem nunca abrir - próximo atraso dobra (2000ms)

    await vi.advanceTimersByTimeAsync(1999)
    expect(WebSocketFalso.instancias).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(WebSocketFalso.instancias).toHaveLength(3)

    WebSocketFalso.instancias[2].disparaQuedaDeConexao(); // dobra de novo (4000ms)

    await vi.advanceTimersByTimeAsync(3999)
    expect(WebSocketFalso.instancias).toHaveLength(3)
    await vi.advanceTimersByTimeAsync(1)
    expect(WebSocketFalso.instancias).toHaveLength(4)
  })

  it('reseta o atraso de reconexão pro valor base depois de uma conexão bem-sucedida', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    renderHook(() => usePresencaWebSocket())
    WebSocketFalso.instancias[0].disparaQuedaDeConexao();
    await vi.advanceTimersByTimeAsync(1000);
    expect(WebSocketFalso.instancias).toHaveLength(2)

    WebSocketFalso.instancias[1].disparaConexaoAberta(); // reconectou de verdade - reseta o contador de tentativas
    WebSocketFalso.instancias[1].disparaQuedaDeConexao(); // cai de novo - deveria voltar pro atraso base, não continuar em 2000ms

    await vi.advanceTimersByTimeAsync(999)
    expect(WebSocketFalso.instancias).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(1)
    expect(WebSocketFalso.instancias).toHaveLength(3)
  })

  it('ao reconectar, ressincroniza o estado a partir do snapshot novo que o servidor manda', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    const { result } = renderHook(() => usePresencaWebSocket())
    act(() => {
      WebSocketFalso.instancias[0].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [{ usuarioId: 1, nome: 'Ana', x: 0, y: 0, status: 'DISPONIVEL' }],
      })
    })
    await waitFor(() => expect(result.current.usuarios[1]).toBeDefined())

    WebSocketFalso.instancias[0].disparaQuedaDeConexao()
    await vi.advanceTimersByTimeAsync(1000)
    expect(WebSocketFalso.instancias).toHaveLength(2)

    // snapshot da nova conexão não tem mais o usuário 1 (saiu enquanto a conexão estava caída) -
    // ressincronizar significa que o estado bate exatamente com esse snapshot, não um merge do antigo
    act(() => {
      WebSocketFalso.instancias[1].disparaMensagem({
        tipo: 'SNAPSHOT',
        usuarios: [{ usuarioId: 2, nome: 'Beto', x: 5, y: 5, status: 'DISPONIVEL' }],
      })
    })

    await waitFor(() => {
      expect(result.current.usuarios[2]).toBeDefined()
      expect(result.current.usuarios[1]).toBeUndefined()
    })
  })

  it('fecha a conexão ao desmontar e não tenta reconectar depois disso', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    const { unmount } = renderHook(() => usePresencaWebSocket())
    const socket = WebSocketFalso.instancias[0]

    unmount()
    await vi.advanceTimersByTimeAsync(5000)

    expect(socket.fechado).toBe(true)
    expect(WebSocketFalso.instancias).toHaveLength(1)
  })
})
