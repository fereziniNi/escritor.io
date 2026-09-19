import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../auth/authStore'
import { decodeJwt } from '../auth/jwt'
import { calcularAtrasoReconexao } from './backoffReconexao'
import { construirUrlWebSocketPresenca } from './presencaSocket'
import { criarEnviadorComThrottle } from './throttlePosicao'
import type {
  ConviteReuniao,
  EstadoPresencaUsuario,
  MensagemRecebida,
  NovaTarefa,
  SinalRtcRecebido,
  SorteioHappyHour,
  StatusAvatar,
  TarefaConcluida,
} from './types'

const ATRASO_RECONEXAO_BASE_MS = 1000
const ATRASO_RECONEXAO_MAXIMO_MS = 30_000
const ATRASO_ENVIO_POSICAO_MS = 100

interface EventoPresencaWs {
  tipo: 'SNAPSHOT' | 'POSICAO' | 'STATUS' | 'APARENCIA'
  usuarios: EstadoPresencaUsuario[]
}

/** Pedido do usuário: "chamar para reunião pela plataforma" - mensagem própria, não confundir com
 * {@link EventoPresencaWs} (que sempre carrega `usuarios`, nunca dados de uma reunião). */
interface ConviteReuniaoWs extends ConviteReuniao {
  tipo: 'CONVITE_REUNIAO'
}

/** Pedido do usuário: "chat... em tempo real... Não deve conter atraso". */
interface ChatMensagemWs extends MensagemRecebida {
  tipo: 'CHAT_MENSAGEM'
}

/** Pedido do usuário: "sempre que alguém finalizar uma tarefa... notificado ao usuário". */
interface TarefaConcluidaWs extends TarefaConcluida {
  tipo: 'TAREFA_CONCLUIDA'
}

/** Pedido do usuário: "quando qualquer pessoa adicionar uma tarefa nova... deve informar todos os
 * usuários do sistema". */
interface NovaTarefaWs extends NovaTarefa {
  tipo: 'NOVA_TAREFA'
}

/** Pedido do usuário: "uma parte para roleta onde será sorteado qual atividade será feita". */
interface SorteioHappyHourWs extends SorteioHappyHour {
  tipo: 'SORTEIO_HAPPY_HOUR'
}

/** Pedido do usuário: "voice, onde podemos falar dentro da sala... ou com a pessoa mais
 * próxima" - sinalização WebRTC relayada (ver `useVozProximidade.ts`). */
interface RtcSinalWs extends SinalRtcRecebido {
  tipo: 'RTC_SINAL'
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
 *
 * Personalização de avatar: mudar a aparência (`avatar/EditorAvatarPage.tsx`) NÃO passa por aqui -
 * é um `PATCH /usuarios/me/aparencia` via REST (não um comando `POSICAO`/`STATUS` pela própria
 * conexão), porque precisa validar a paleta de cor e persistir no banco. O `onmessage` acima já
 * trata `tipo: "APARENCIA"` genericamente (merge no `usuarios` igual `POSICAO`/`STATUS`), então o
 * próprio usuário vê a mudança refletida sozinho assim que o servidor rebroadcasta pra sessão dele
 * mesma (nenhum código extra necessário aqui pra isso).
 *
 * Pedido do usuário: "anda pro lado que eu quero e depois volta" - o servidor ecoa de volta
 * (broadcast) toda posição que processa, inclusive a nossa própria, e esse eco pode chegar pela
 * rede depois da gente já ter avançado mais passos localmente por predição (`mover` abaixo nunca
 * espera confirmação nenhuma); aplicar x/y desse eco atrasado "puxava" o personagem de volta pra
 * uma posição já ultrapassada. A partir da primeira vez que `mover` roda de verdade
 * (`jaMoveuLocalmenteRef`), o merge genérico do `onmessage` (fora do `SNAPSHOT`) para de
 * sobrescrever x/y de nós mesmos com o que vem numa mensagem `POSICAO`/`STATUS`/`APARENCIA` sobre
 * o próprio usuário - os outros campos (status, aparência) continuam vindo do servidor
 * normalmente, só x/y ficam protegidos. Antes da primeira predição local (ex.: alguém simulando/
 * empurrando uma posição pra nós de fora, sem passar por `mover`) o valor do servidor ainda é a
 * única fonte de verdade que existe, então continua sendo aplicado normalmente.
 */
export function usePresencaWebSocket() {
  const accessToken = useAuthStore((state) => state.accessToken)
  const [usuarios, setUsuarios] = useState<Record<number, EstadoPresencaUsuario>>({})
  const [convitesRecebidos, setConvitesRecebidos] = useState<ConviteReuniao[]>([])
  const [mensagensRecebidas, setMensagensRecebidas] = useState<MensagemRecebida[]>([])
  const [tarefasConcluidasRecebidas, setTarefasConcluidasRecebidas] = useState<TarefaConcluida[]>([])
  const [novasTarefasRecebidas, setNovasTarefasRecebidas] = useState<NovaTarefa[]>([])
  const [sorteiosHappyHourRecebidos, setSorteiosHappyHourRecebidos] = useState<SorteioHappyHour[]>([])
  const [sinaisRtcRecebidos, setSinaisRtcRecebidos] = useState<SinalRtcRecebido[]>([])
  const enviarPosicaoRef = useRef<(x: number, y: number) => void>(() => {})
  const socketRef = useRef<WebSocket | null>(null)
  // Verdadeiro assim que `mover` roda pela primeira vez (predição local de verdade, não um
  // SNAPSHOT/eco vindo do servidor) - ver o comentário completo do `onmessage` abaixo sobre por
  // que só a partir daí um eco de POSICAO sobre nós mesmos deixa de mexer em x/y.
  const jaMoveuLocalmenteRef = useRef(false)

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
        const dados = JSON.parse(evento.data as string) as
          | EventoPresencaWs
          | ConviteReuniaoWs
          | ChatMensagemWs
          | TarefaConcluidaWs
          | NovaTarefaWs
          | SorteioHappyHourWs
          | RtcSinalWs
        if (dados.tipo === 'CONVITE_REUNIAO') {
          setConvitesRecebidos((atual) => [...atual, dados])
          return
        }
        if (dados.tipo === 'CHAT_MENSAGEM') {
          setMensagensRecebidas((atual) => [...atual, dados])
          return
        }
        if (dados.tipo === 'TAREFA_CONCLUIDA') {
          setTarefasConcluidasRecebidas((atual) => [...atual, dados])
          return
        }
        if (dados.tipo === 'NOVA_TAREFA') {
          setNovasTarefasRecebidas((atual) => [...atual, dados])
          return
        }
        if (dados.tipo === 'SORTEIO_HAPPY_HOUR') {
          setSorteiosHappyHourRecebidos((atual) => [...atual, dados])
          return
        }
        if (dados.tipo === 'RTC_SINAL') {
          setSinaisRtcRecebidos((atual) => [...atual, dados])
          return
        }
        setUsuarios((atual) => {
          const proximo = dados.tipo === 'SNAPSHOT' ? {} : { ...atual }
          dados.usuarios.forEach((usuario) => {
            // Pedido do usuário: "anda pro lado que eu quero e depois volta" - o servidor
            // ecoa de volta (broadcast) toda posição que ele mesmo mandou, inclusive a nossa -
            // essa mensagem viaja pela rede e pode chegar DEPOIS da gente já ter avançado mais
            // alguns passos localmente (predição, sem esperar confirmação nenhuma - ver `mover`
            // abaixo). Sobrescrever x/y com esse eco atrasado "puxava" o personagem de volta pra
            // uma posição já ultrapassada, visível como "anda pro lado certo e volta". Só entra
            // aqui depois que `mover` já rodou pelo menos uma vez de verdade
            // (`jaMoveuLocalmenteRef`) - antes disso (SNAPSHOT à parte, sempre a fonte da posição
            // inicial) o valor do servidor é a única informação de posição que existe, não tem
            // predição local nenhuma pra "proteger" ainda. O status continua vindo do servidor
            // pra nós mesmos de qualquer forma (mudar de zona troca o status automaticamente do
            // lado do servidor, e isso não tem predição local nenhuma).
            if (dados.tipo !== 'SNAPSHOT' && usuario.usuarioId === meuUsuarioId && atual[meuUsuarioId] && jaMoveuLocalmenteRef.current) {
              proximo[usuario.usuarioId] = { ...usuario, x: atual[meuUsuarioId].x, y: atual[meuUsuarioId].y }
              return
            }
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
    jaMoveuLocalmenteRef.current = true
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

  /** Pedido do usuário: "voice... com a pessoa mais próxima" - manda um sinal WebRTC (SDP offer/
   * answer ou ICE candidate) pra um destinatário específico, pelo mesmo socket já aberto (sem
   * conexão nova só pra sinalização). `useVozProximidade.ts` é quem decide o conteúdo de `sinal`
   * e pra quem mandar. */
  function enviarSinalRtc(destinatarioId: number, sinal: unknown) {
    socketRef.current?.send(JSON.stringify({ tipo: 'RTC_SINAL', destinatarioId, sinal }))
  }

  return {
    usuarios,
    meuUsuarioId,
    mover,
    definirStatus,
    convitesRecebidos,
    mensagensRecebidas,
    tarefasConcluidasRecebidas,
    novasTarefasRecebidas,
    sorteiosHappyHourRecebidos,
    sinaisRtcRecebidos,
    enviarSinalRtc,
  }
}
