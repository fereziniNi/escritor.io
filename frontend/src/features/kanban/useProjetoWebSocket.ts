import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuthStore } from '../auth/authStore'
import { construirUrlWebSocketProjeto } from './projetoSocket'

const ATRASO_RECONEXAO_MS = 2000

/**
 * Conecta em `/ws/projeto/{id}` (S3.11) e invalida a query do projeto sempre que o servidor manda
 * um evento - não tenta aplicar o payload otimisticamente aqui (isso já é papel do
 * `moverCardOtimista` na própria mutação de quem arrastou); pra quem só está *olhando* o projeto,
 * um refetch simples é suficiente e evita duplicar a lógica de merge em dois lugares. Reconecta
 * com um atraso fixo se a conexão cair sem ter sido o próprio componente fechando - backoff
 * exponencial (mencionado no PRD §5) fica pra quando o padrão de uso real pedir; um atraso fixo
 * já resolve o caso comum (backend reiniciou, rede oscilou).
 */
export function useProjetoWebSocket(projetoId: number) {
  const queryClient = useQueryClient()
  const accessToken = useAuthStore((state) => state.accessToken)

  useEffect(() => {
    if (!accessToken) {
      return undefined
    }

    let socket: WebSocket | null = null
    let timeoutReconexao: ReturnType<typeof setTimeout> | null = null
    let desmontado = false

    function conectar() {
      socket = new WebSocket(construirUrlWebSocketProjeto(projetoId, accessToken!, window.location.origin))

      socket.onmessage = () => {
        queryClient.invalidateQueries({ queryKey: ['projetos', projetoId] })
      }

      socket.onclose = () => {
        if (!desmontado) {
          timeoutReconexao = setTimeout(conectar, ATRASO_RECONEXAO_MS)
        }
      }
    }

    conectar()

    return () => {
      desmontado = true
      if (timeoutReconexao) {
        clearTimeout(timeoutReconexao)
      }
      socket?.close()
    }
  }, [projetoId, accessToken, queryClient])
}
