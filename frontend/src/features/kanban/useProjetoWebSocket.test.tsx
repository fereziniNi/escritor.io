import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '../auth/authStore'
import { useProjetoWebSocket } from './useProjetoWebSocket'

/**
 * jsdom não implementa WebSocket de verdade - mesma filosofia já usada pro drag-and-drop
 * (getBoundingClientRect sempre zerado): aqui a peça não-testável é o transporte em si, então um
 * fake mínimo basta pra provar o *comportamento* do hook (conecta com a URL certa, invalida a
 * query ao receber mensagem, reconecta se a conexão cair, fecha limpo ao desmontar). O gesto de
 * verdade (dois browsers reais recebendo o broadcast) só é verificado manualmente/Playwright.
 */
class WebSocketFalso {
  static instancias: WebSocketFalso[] = []
  static ULTIMA_URL: string | undefined

  url: string
  onmessage: ((evento: MessageEvent) => void) | null = null
  onclose: (() => void) | null = null
  fechado = false

  constructor(url: string) {
    this.url = url
    WebSocketFalso.ULTIMA_URL = url
    WebSocketFalso.instancias.push(this)
  }

  close() {
    this.fechado = true
    this.onclose?.()
  }

  disparaMensagem() {
    this.onmessage?.({ data: '{}' } as MessageEvent)
  }

  disparaQuedaDeConexao() {
    this.onclose?.()
  }
}

const ESTADO_INICIAL = useAuthStore.getState()

beforeEach(() => {
  useAuthStore.setState(ESTADO_INICIAL, true)
  useAuthStore.getState().definirSessao('token-fake', 'COLABORADOR')
  WebSocketFalso.instancias = []
  vi.stubGlobal('WebSocket', WebSocketFalso)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient()
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useProjetoWebSocket', () => {
  it('conecta em /ws/projeto/{id} com o token da sessão', () => {
    renderHook(() => useProjetoWebSocket(5), { wrapper })

    expect(WebSocketFalso.instancias).toHaveLength(1)
    expect(WebSocketFalso.instancias[0].url).toContain('/ws/projeto/5')
    expect(WebSocketFalso.instancias[0].url).toContain('token=token-fake')
  })

  it('invalida a query do projeto ao receber uma mensagem', async () => {
    const queryClient = new QueryClient()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    function wrapperComClient({ children }: { children: ReactNode }) {
      return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    }

    renderHook(() => useProjetoWebSocket(5), { wrapper: wrapperComClient })
    WebSocketFalso.instancias[0].disparaMensagem()

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['projetos', 5] })
    })
  })

  it('reconecta se a conexão cair sem ter sido fechada pelo próprio componente', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    renderHook(() => useProjetoWebSocket(5), { wrapper })
    expect(WebSocketFalso.instancias).toHaveLength(1)

    WebSocketFalso.instancias[0].disparaQuedaDeConexao()
    await vi.advanceTimersByTimeAsync(5000)

    expect(WebSocketFalso.instancias.length).toBeGreaterThanOrEqual(2)
  })

  it('fecha a conexão ao desmontar e não tenta reconectar depois disso', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    const { unmount } = renderHook(() => useProjetoWebSocket(5), { wrapper })
    const socket = WebSocketFalso.instancias[0]

    unmount()
    await vi.advanceTimersByTimeAsync(5000)

    expect(socket.fechado).toBe(true)
    expect(WebSocketFalso.instancias).toHaveLength(1)
  })
})
