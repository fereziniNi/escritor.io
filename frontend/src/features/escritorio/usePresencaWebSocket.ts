import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../auth/authStore'
import { decodeJwt } from '../auth/jwt'
import { construirUrlWebSocketPresenca } from './presencaSocket'
import { criarEnviadorComThrottle } from './throttlePosicao'
import type { EstadoPresencaUsuario, StatusAvatar } from './types'

const ATRASO_RECONEXAO_MS = 2000
const ATRASO_ENVIO_POSICAO_MS = 100

interface EventoPresencaWs {
  tipo: 'SNAPSHOT' | 'POSICAO' | 'STATUS'
  usuarios: EstadoPresencaUsuario[]
}

/**
 * Conecta em `/ws/presenca` (S6.3/S6.4/S6.6) e mantém o estado de todo mundo presente, indexado
 * por `usuarioId`. `mover` atualiza a própria posição *local* de imediato (predição, sem esperar
 * o servidor) e agenda o envio pela rede com throttle (`criarEnviadorComThrottle`, máx. a cada
 * 100ms - PRD); `definirStatus` (S6.6) faz o mesmo pro status manual, mas sem throttle - trocar
 * de status não é um fluxo de alta frequência como mover o avatar a cada tecla, então não tem
 * janela de rede pra respeitar aqui. Reconecta com atraso fixo, mesmo padrão de
 * `useQuadroWebSocket` (kanban, S3.11) - backoff exponencial fica pra S6.10.
 */
export function usePresencaWebSocket() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const [usuarios, setUsuarios] = useState<Record<number, EstadoPresencaUsuario>>({})
  const enviarPosicaoRef = useRef<(x: number, y: number) => void>(() => {})
  const socketRef = useRef<WebSocket | null>(null)

  const meuUsuarioId = accessToken ? Number(decodeJwt(accessToken).sub) : null

  useEffect(() => {
    if (!accessToken) {
      return undefined
    }

    let socket: WebSocket | null = null
    let timeoutReconexao: ReturnType<typeof setTimeout> | null = null
    let desmontado = false

    function conectar() {
      socket = new WebSocket(construirUrlWebSocketPresenca(accessToken!, window.location.origin))
      const socketDestaConexao = socket
      socketRef.current = socket

      socket.onmessage = (evento) => {
        const dados = JSON.parse(evento.data as string) as EventoPresencaWs
        setUsuarios((atual) => {
          const proximo = dados.tipo === 'SNAPSHOT' ? {} : { ...atual }
          dados.usuarios.forEach((usuario) => {
            proximo[usuario.usuarioId] = usuario
          })
          return proximo
        })
      }

      socket.onclose = () => {
        if (!desmontado) {
          timeoutReconexao = setTimeout(conectar, ATRASO_RECONEXAO_MS)
        }
      }

      enviarPosicaoRef.current = criarEnviadorComThrottle((x, y) => {
        socketDestaConexao.send(JSON.stringify({ tipo: 'POSICAO', x, y }))
      }, ATRASO_ENVIO_POSICAO_MS)
    }

    conectar()

    return () => {
      desmontado = true
      if (timeoutReconexao) {
        clearTimeout(timeoutReconexao)
      }
      socket?.close()
    }
  }, [accessToken])

  function mover(x: number, y: number) {
    if (meuUsuarioId === null) {
      return
    }
    setUsuarios((atual) => {
      const eu = atual[meuUsuarioId]
      if (!eu) {
        return atual
      }
      return { ...atual, [meuUsuarioId]: { ...eu, x, y } }
    })
    enviarPosicaoRef.current(x, y)
  }

  function definirStatus(status: StatusAvatar) {
    if (meuUsuarioId === null) {
      return
    }
    setUsuarios((atual) => {
      const eu = atual[meuUsuarioId]
      if (!eu) {
        return atual
      }
      return { ...atual, [meuUsuarioId]: { ...eu, status } }
    })
    socketRef.current?.send(JSON.stringify({ tipo: 'STATUS', status }))
  }

  return { usuarios, meuUsuarioId, mover, definirStatus }
}
