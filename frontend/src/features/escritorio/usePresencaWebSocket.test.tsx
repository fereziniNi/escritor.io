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

/** jsdom não implementa WebSocket de verdade - mesma filosofia de `useQuadroWebSocket.test.tsx`. */
class WebSocketFalso {
  static instancias: WebSocketFalso[] = []

  url: string
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

    expect(WebSocketFalso.instancias[0].mensagensEnviadas).toContain(JSON.stringify({ x: 1, y: 0 }))
  })

  it('reconecta se a conexão cair sem ter sido fechada pelo próprio componente', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    renderHook(() => usePresencaWebSocket())
    expect(WebSocketFalso.instancias).toHaveLength(1)

    WebSocketFalso.instancias[0].disparaQuedaDeConexao()
    await vi.advanceTimersByTimeAsync(5000)

    expect(WebSocketFalso.instancias.length).toBeGreaterThanOrEqual(2)
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
