import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../auth/authStore'
import { decodeJwt } from '../auth/jwt'
import { calcularAtrasoReconexao } from './backoffReconexao'
import { construirUrlWebSocketPresenca } from './presencaSocket'
import { criarEnviadorComThrottle } from './throttlePosicao'
import type { EstadoPresencaUsuario, StatusAvatar } from './types'

const ATRASO_RECONEXAO_BASE_MS = 1000
const ATRASO_RECONEXAO_MAXIMO_MS = 30_000
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
 * janela de rede pra respeitar aqui. Reconecta com backoff exponencial (`calcularAtrasoReconexao`,
 * S6.10, PRD) - dobra a cada tentativa sucessiva sem conseguir reconectar, até um teto, e reseta
 * pro atraso base assim que uma conexão abre de verdade (`onopen`), pra uma queda futura não
 * herdar o atraso já escalado de uma queda anterior e resolvida. Ao reconectar, o servidor manda
 * um `SNAPSHOT` de novo (mesmo em toda conexão nova, S6.3) - `usuarios` é *substituído* inteiro
 * nesse caso (não mesclado), então a ressincronização já vem de graça da lógica de `onmessage`
 * que já existia, sem nada especial pra escrever aqui.
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
    let tentativasReconexao = 0

    function conectar() {
      socket = new WebSocket(construirUrlWebSocketPresenca(accessToken!, window.location.origin))
      const socketDestaConexao = socket
      socketRef.current = socket

      socket.onopen = () => {
        tentativasReconexao = 0
      }

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
          const atraso = calcularAtrasoReconexao(tentativasReconexao, ATRASO_RECONEXAO_BASE_MS, ATRASO_RECONEXAO_MAXIMO_MS)
          tentativasReconexao += 1
          timeoutReconexao = setTimeout(conectar, atraso)
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
