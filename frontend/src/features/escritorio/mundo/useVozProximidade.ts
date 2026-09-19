import { useEffect, useMemo, useRef, useState } from 'react'
import type { SinalRtcRecebido } from '../types'
import { PROXIMIDADE_RAIO_TILES } from './constantes'
import { calcularVolumePorDistancia, type ParProximo } from './proximidade'

/** Bug real relatado pelo usuário: "abro o microfone e falo, quem está do lado não escuta" - só
 * STUN não basta quando alguém está atrás de NAT restritivo/CGNAT (comum em rede móvel/corporativa
 * no Brasil); a conexão simplesmente nunca fecha e fica muda, sem erro nenhum pro usuário
 * (`onconnectionstatechange` abaixo). TURN retransmite o áudio quando a conexão direta P2P não é
 * possível.
 *
 * Primeira tentativa (Open Relay Project, credenciais públicas fixas) verificada ao vivo como
 * quebrada - o servidor rejeitava toda alocação com erro 400. Trocado pela conta gratuita do
 * usuário na Metered.ca (sem cartão), que gera credenciais de TURN de verdade sob demanda via
 * `/api/v1/turn/credentials` - essa chave é feita pra ir no cliente (é assim que a própria Metered
 * documenta o uso), só autoriza gerar credenciais de TURN de curta duração, não é um segredo de
 * conta. */
const METERED_DOMINIO = 'escritorio-io.metered.live'
const METERED_API_KEY = 'ff79f8a1bb8b6272c5713bf36a75e3eb7c85'

const STUN_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }]

/** Busca os servidores TURN da Metered - chamada uma vez só por montagem do hook (efeito com `[]`
 * mais abaixo, que já evita rebuscar à toa), então não precisa de cache próprio aqui. Se a busca
 * falhar (Metered fora do ar, chave revogada), cai de volta pro STUN puro em vez de travar a voz
 * por proximidade inteira. */
async function buscarIceServers(): Promise<RTCIceServer[]> {
  try {
    const resposta = await fetch(`https://${METERED_DOMINIO}/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`)
    const turnServers = (await resposta.json()) as RTCIceServer[]
    return [...STUN_SERVERS, ...turnServers]
  } catch {
    return STUN_SERVERS
  }
}

const LIMIAR_FALANDO = 0.02
const INTERVALO_DETECCAO_MS = 200

interface PeerAtivo {
  conexao: RTCPeerConnection
  audioEl: HTMLAudioElement
  /** Um transceiver de áudio só por conexão - vira `sendrecv` quando o microfone liga (ver
   * `atualizarTransmissaoLocal`), sem nunca recriar a conexão nem o transceiver. `null` só no
   * intervalo entre a conexão nascer (proximidade) e a primeira oferta chegar, quando EU não sou
   * quem inicia - ver comentário em `criarConexao` sobre por que não dá pra criar um aqui de
   * propósito nesse caso. */
  transceiver: RTCRtpTransceiver | null
}

/** Sempre o `usuarioId` menor cria a oferta inicial - evita "glare" (as duas pontas ofertando ao
 * mesmo tempo) sem precisar de um protocolo de negociação mais complexo (perfect negotiation).
 * Pura e exportada pra dar pra testar a regra isolada, sem WebRTC de verdade. */
export function souIniciador(meuUsuarioId: number, outroUsuarioId: number): boolean {
  return meuUsuarioId < outroUsuarioId
}

interface Params {
  meuUsuarioId: number | null
  ativo: boolean
  paresDeVoz: ParProximo[]
  sinaisRtcRecebidos: SinalRtcRecebido[]
  enviarSinalRtc: (destinatarioId: number, sinal: unknown) => void
}

/**
 * Pedido do usuário: "voice, onde podemos falar dentro da sala... ou podemos falar com a pessoa
 * mais próxima... Implemente da melhor maneira possível" - um `RTCPeerConnection` por peer de voz
 * que me envolve agora (mesh, não SFU - times pequenos como este raramente têm mais de 2-3 pessoas
 * conectadas ao mesmo tempo, então o custo de N conexões diretas é aceitável). Sinalização
 * (offer/answer/ICE) passa pelo `/ws/presenca` já aberto (`enviarSinalRtc`/`sinaisRtcRecebidos`,
 * ver `usePresencaWebSocket.ts`) - sem servidor de sinalização novo.
 *
 * Pedido do usuário (segunda rodada): "No microfone deve ter o som ligado sempre. Só o microfone
 * que deve estar disponível para ligar e desligar" - ouvir quem está por perto NÃO depende mais do
 * meu microfone estar ligado: a conexão com cada peer do par nasce assim que a proximidade forma
 * (`paresDeVoz`), sempre pronta pra receber áudio (`recvonly`). Só `ativo` (o botão de mic da
 * toolbar) liga/desliga se EU transmito - muda a direção do transceiver pra `sendrecv`/`recvonly`
 * e troca a track (`atualizarTransmissaoLocal`), sem nunca fechar a conexão por causa do mic.
 * `getUserMedia` continua opt-in - só é pedido quando a pessoa clica em ligar o microfone.
 */
export function useVozProximidade({ meuUsuarioId, ativo, paresDeVoz, sinaisRtcRecebidos, enviarSinalRtc }: Params) {
  const [falando, setFalando] = useState<Set<number>>(new Set())

  const streamLocalRef = useRef<MediaStream | null>(null)
  const conexoesRef = useRef<Map<number, PeerAtivo>>(new Map())
  const audioContextRef = useRef<AudioContext | null>(null)
  const analisadoresRef = useRef<Map<number | 'local', AnalyserNode>>(new Map())
  const enviarSinalRtcRef = useRef(enviarSinalRtc)
  enviarSinalRtcRef.current = enviarSinalRtc
  const audioEmEsperaDeGestoRef = useRef<Set<HTMLAudioElement>>(new Set())

  /** Busca os ICE servers uma vez, assim que o hook monta - fora do caminho de `criarConexao` de
   * propósito: `criarConexao` precisa continuar 100% síncrona até `conexoesRef.current.set(...)`
   * (ver comentário lá) pra não reabrir a corrida de criar duas conexões pro mesmo par. Começa só
   * com STUN (`iceServersRef.current`) e troca pra STUN+TURN assim que a Metered responder.
   * Limitação aceita: se um par de voz já existir no exato instante em que o hook monta (raro - a
   * pessoa precisa estar exatamente ao lado de alguém já no primeiro render), essa primeira
   * conexão pode nascer só com STUN, porque a promise da busca nunca resolve na mesma volta
   * síncrona que o efeito de pareamento roda - `RTCPeerConnection` não deixa trocar `iceServers`
   * depois de criada. Qualquer par formado depois (o caso comum - a pessoa anda até perto de
   * alguém) já pega STUN+TURN normalmente. */
  const iceServersRef = useRef<RTCIceServer[]>(STUN_SERVERS)
  useEffect(() => {
    let cancelado = false
    buscarIceServers().then((servidores) => {
      if (!cancelado) {
        iceServersRef.current = servidores
      }
    })
    return () => {
      cancelado = true
    }
  }, [])

  /** Bug real relatado pelo usuário: "eu falo, mas quem está do lado não escuta nada" - mesma rede
   * (confirmado com o usuário), então não é NAT/TURN (verificado ao vivo: a conexão conecta
   * normal). A política de autoplay do Chrome bloqueia `.play()` com som quando a página ainda não
   * teve NENHUMA interação do usuário (clique/tecla) - como a conexão de voz nasce sozinha pela
   * proximidade (pedido: "o som deve estar ligado sempre"), quem fica parado e alguém chega perto
   * SEM que a pessoa que vai ouvir tenha clicado/digitado nada antes pode nunca ter "ativação de
   * usuário" nenhuma - `.play()` rejeita, o código antigo só ignorava o erro
   * ("inofensivo... o áudio some quando o par muda de novo" - falso quando o par NÃO muda, o caso
   * comum de duas pessoas paradas perto uma da outra) e o elemento ficava mudo pra sempre. Registra
   * o elemento que falhou e tenta de novo no primeiro gesto real do usuário na página. */
  useEffect(() => {
    function tentarDeNovo() {
      audioEmEsperaDeGestoRef.current.forEach((audioEl) => {
        audioEl
          .play()
          .then(() => audioEmEsperaDeGestoRef.current.delete(audioEl))
          .catch(() => {
            // continua na espera - o próximo gesto tenta de novo.
          })
      })
    }
    window.addEventListener('pointerdown', tentarDeNovo)
    window.addEventListener('keydown', tentarDeNovo)
    return () => {
      window.removeEventListener('pointerdown', tentarDeNovo)
      window.removeEventListener('keydown', tentarDeNovo)
    }
  }, [])

  const meusPeerIds = useMemo(() => {
    const ids = new Set<number>()
    if (meuUsuarioId === null) {
      return ids
    }
    for (const par of paresDeVoz) {
      if (par.usuarioIdA === meuUsuarioId) {
        ids.add(par.usuarioIdB)
      } else if (par.usuarioIdB === meuUsuarioId) {
        ids.add(par.usuarioIdA)
      }
    }
    return ids
  }, [paresDeVoz, meuUsuarioId])

  const distanciaPorPeer = useMemo(() => {
    const mapa = new Map<number, number>()
    if (meuUsuarioId === null) {
      return mapa
    }
    for (const par of paresDeVoz) {
      if (par.usuarioIdA === meuUsuarioId) {
        mapa.set(par.usuarioIdB, par.distanciaTiles)
      } else if (par.usuarioIdB === meuUsuarioId) {
        mapa.set(par.usuarioIdA, par.distanciaTiles)
      }
    }
    return mapa
  }, [paresDeVoz, meuUsuarioId])

  function garantirAudioContext(): AudioContext {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    return audioContextRef.current
  }

  function registrarAnalisador(chave: number | 'local', stream: MediaStream) {
    const contexto = garantirAudioContext()
    const analisador = contexto.createAnalyser()
    analisador.fftSize = 512
    contexto.createMediaStreamSource(stream).connect(analisador)
    analisadoresRef.current.set(chave, analisador)
  }

  function fecharPeer(peerId: number) {
    const peer = conexoesRef.current.get(peerId)
    if (!peer) {
      return
    }
    peer.conexao.close()
    peer.audioEl.pause()
    peer.audioEl.srcObject = null
    peer.audioEl.remove()
    audioEmEsperaDeGestoRef.current.delete(peer.audioEl)
    conexoesRef.current.delete(peerId)
    analisadoresRef.current.delete(peerId)
  }

  /** A conexão nasce assim que a proximidade forma o par - independente do microfone estar ligado
   * (pedido do usuário: "o som deve estar ligado sempre"). Só quem VAI OFERECER
   * (`comOferta`/`souIniciador`) cria o transceiver aqui, de propósito - é ele que declara o
   * m-line no offer. Bug real encontrado ao vivo: criar um transceiver aqui pro lado que só vai
   * RESPONDER não funciona - quando a oferta chega, o navegador cria um SEGUNDO transceiver de
   * verdade pra casar com o m-line recebido, e o que foi pré-criado fica órfão (nunca ganha
   * `mid`, `ontrack` nunca dispara nele). Quem só responde ganha o transceiver certo, automático,
   * assim que aplica a oferta (`setRemoteDescription` no efeito de sinalização) - `transceiver`
   * fica `null` até lá. */
  async function criarConexao(peerId: number, comOferta: boolean) {
    if (conexoesRef.current.has(peerId)) {
      return
    }
    const conexao = new RTCPeerConnection({ iceServers: iceServersRef.current })
    const transceiver = comOferta ? conexao.addTransceiver('audio', { direction: 'recvonly' }) : null

    const audioEl = document.createElement('audio')
    audioEl.autoplay = true
    audioEl.dataset.vozPeerId = String(peerId)
    // `createElement` sozinho deixa o elemento "solto" (fora da árvore do documento) - alguns
    // navegadores tocam áudio de um `<audio>` desanexado, mas não é garantido/consistente.
    // Invisível (não precisa aparecer - só toca som), mas precisa estar no DOM de verdade.
    audioEl.hidden = true
    document.body.appendChild(audioEl)

    conexao.onicecandidate = (evento) => {
      if (evento.candidate) {
        enviarSinalRtcRef.current(peerId, evento.candidate.toJSON())
      }
    }
    conexao.ontrack = (evento) => {
      // `evento.streams` pode vir vazio - `addTrack(track, stream)` associa um stream de
      // propósito (permite ouvir aqui), mas aqui a track entra via `transceiver.sender.
      // replaceTrack(track)` (ver `atualizarTransmissaoLocal`/`criarConexao`), que NÃO associa
      // stream nenhum ao sender - bug real encontrado ao vivo (`ontrack` disparava, mas sem
      // stream, então nunca tocava nada). Monta um `MediaStream` a partir da track em si nesse
      // caso - funciona igual, `evento.track` sempre vem preenchido independente disso.
      const stream = evento.streams[0] ?? new MediaStream([evento.track])
      audioEl.srcObject = stream
      // `.play()` pode rejeitar a Promise OU lançar sincronamente dependendo do ambiente (jsdom
      // nos testes, políticas de autoplay em navegadores de verdade). Bug real relatado pelo
      // usuário: numa rejeição por autoplay (sem gesto do usuário ainda na página - ver o efeito
      // que registra `pointerdown`/`keydown` acima), o elemento ficava mudo pra sempre, porque o
      // par de voz raramente muda de novo (duas pessoas paradas perto uma da outra) - marca o
      // elemento pra tentar de novo no próximo gesto em vez de desistir silenciosamente.
      try {
        audioEl.play()?.catch(() => audioEmEsperaDeGestoRef.current.add(audioEl))
      } catch {
        audioEmEsperaDeGestoRef.current.add(audioEl)
      }
      registrarAnalisador(peerId, stream)
    }
    conexao.onconnectionstatechange = () => {
      if (conexao.connectionState === 'failed' || conexao.connectionState === 'closed') {
        fecharPeer(peerId)
      }
    }

    conexoesRef.current.set(peerId, { conexao, audioEl, transceiver })

    if (transceiver) {
      await aplicarStreamLocal(transceiver)
    }

    if (comOferta) {
      await ofertar(peerId, conexao)
    }
  }

  /** Reflete o estado ATUAL do stream local (ligado ou não) num transceiver que acabou de passar
   * a existir de verdade - usado tanto na criação (quando EU ofereço) quanto assim que o
   * transceiver do lado que só responde é conhecido (depois de aplicar a oferta recebida). */
  async function aplicarStreamLocal(transceiver: RTCRtpTransceiver) {
    const trackLocal = streamLocalRef.current?.getAudioTracks()[0] ?? null
    transceiver.direction = trackLocal ? 'sendrecv' : 'recvonly'
    await transceiver.sender.replaceTrack(trackLocal)
  }

  /** Só quem "oferece" por padrão (`souIniciador`) pode mandar uma oferta - continua valendo pra
   * renegociação, não só pra primeira vez (mesma regra evita a mesma colisão de sempre: as duas
   * pontas ofertando ao mesmo tempo). `signalingState !== 'stable'` é uma segunda trava - pula
   * uma renegociação se já tiver outra em andamento (simplificação aceita: rara, a próxima
   * mudança de estado corrige). */
  async function ofertar(peerId: number, conexao: RTCPeerConnection) {
    if (conexao.signalingState !== 'stable') {
      return
    }
    const oferta = await conexao.createOffer()
    await conexao.setLocalDescription(oferta)
    enviarSinalRtcRef.current(peerId, { type: oferta.type, sdp: oferta.sdp })
  }

  /** Pedido do usuário: "só o microfone que deve estar disponível para ligar e desligar" - muda
   * se EU transmito pras conexões que já estão abertas, sem fechar/recriar nada (continuo
   * recebendo o áudio de quem está no meu par, ligado ou não). Se o transceiver de um peer ainda
   * é `null` (ainda não recebi a oferta inicial dele - só acontece quando EU não sou quem
   * inicia), não tem nada pra atualizar agora: `aplicarStreamLocal` já vai ler o estado atual do
   * microfone assim que o transceiver de verdade existir (ver `criarConexao`/o ramo de "offer"
   * abaixo), então essa mudança não se perde, só fica pendente. Mudar a direção/track de um
   * transceiver depois da negociação inicial exige renegociar (novo offer/answer): quem tem o id
   * menor (`souIniciador`) manda a oferta nova direto, igual na negociação inicial; o outro lado
   * não pode ofertar (senão as duas pontas colidiriam se ligassem o mic ao mesmo tempo) - só pede
   * pro outro renegociar (`renegociar`, sinal novo e opaco igual aos outros); a oferta que volta já
   * reflete minha track/direção atual, porque já apliquei as duas ANTES de pedir. */
  async function atualizarTransmissaoLocal() {
    if (meuUsuarioId === null) {
      return
    }
    for (const [peerId, peer] of conexoesRef.current) {
      if (!peer.transceiver) {
        continue
      }
      await aplicarStreamLocal(peer.transceiver)
      if (souIniciador(meuUsuarioId, peerId)) {
        await ofertar(peerId, peer.conexao)
      } else {
        enviarSinalRtcRef.current(peerId, { type: 'renegociar' })
      }
    }
  }

  // liga/desliga o microfone (pedido do usuário: mic é opt-in - só pede permissão quando a
  // pessoa clica no botão, nunca antes). NÃO fecha conexão nenhuma - só troca o que é transmitido
  // nas conexões que já existem (`atualizarTransmissaoLocal`).
  useEffect(() => {
    if (!ativo || meuUsuarioId === null) {
      streamLocalRef.current?.getTracks().forEach((track) => track.stop())
      streamLocalRef.current = null
      analisadoresRef.current.delete('local')
      void atualizarTransmissaoLocal()
      return undefined
    }

    let cancelado = false
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (cancelado) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamLocalRef.current = stream
        registrarAnalisador('local', stream)
        void atualizarTransmissaoLocal()
      })
      .catch(() => {
        // permissão negada ou sem microfone - o botão simplesmente não liga de verdade, sem
        // travar o resto da página.
      })

    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, meuUsuarioId])

  // abre/fecha conexão conforme quem está no meu par de voz muda - independente do microfone
  // estar ligado (pedido do usuário: "o som deve estar ligado sempre"), a pessoa anda, sai do
  // raio, a conexão fecha sozinha.
  useEffect(() => {
    if (meuUsuarioId === null) {
      return
    }
    for (const peerId of meusPeerIds) {
      if (!conexoesRef.current.has(peerId)) {
        criarConexao(peerId, souIniciador(meuUsuarioId, peerId))
      }
    }
    for (const peerId of conexoesRef.current.keys()) {
      if (!meusPeerIds.has(peerId)) {
        fecharPeer(peerId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meusPeerIds, meuUsuarioId])

  // processa sinais novos recebidos (mesma técnica de "só itens novos" usada em EscritorioPage
  // pros outros eventos do WS). Processados em ORDEM e um de cada vez (`await` por sinal, não só
  // disparado e esquecido) - se a oferta e os primeiros candidatos ICE chegarem no mesmo lote (o
  // React só reprocessa quando renderiza de novo, então vários sinais podem se acumular entre uma
  // renderização e outra), `addIceCandidate` só roda depois que `setRemoteDescription` da
  // oferta/resposta já terminou; do contrário o navegador rejeita o candidato (ainda sem descrição
  // remota) e ele se perde de vez. O mesmo ramo de "offer" atende tanto a oferta inicial quanto
  // uma renegociação (mic ligando/desligando do outro lado) - `criarConexao` já não faz nada se a
  // conexão já existe, então só aplica a nova descrição na conexão certa.
  const sinaisProcessadosRef = useRef(0)
  useEffect(() => {
    const novos = sinaisRtcRecebidos.slice(sinaisProcessadosRef.current)
    sinaisProcessadosRef.current = sinaisRtcRecebidos.length
    ;(async () => {
      for (const { remetenteId, sinal } of novos) {
        const dados = sinal as { type?: string; sdp?: string; candidate?: string } | null
        if (!dados) {
          continue
        }
        if (dados.type === 'offer') {
          await criarConexao(remetenteId, false)
          const peer = conexoesRef.current.get(remetenteId)
          if (!peer) {
            continue
          }
          await peer.conexao.setRemoteDescription(dados as RTCSessionDescriptionInit)
          // primeira oferta que chega pra uma conexão onde EU não sou quem inicia: só agora o
          // transceiver de verdade existe (o navegador cria o dele já casado com o m-line
          // recebido) - pega essa referência (não cria mais nenhum, `criarConexao` não criou
          // nenhum de propósito pra este caso, ver comentário lá) e já aplica o microfone atual.
          if (!peer.transceiver) {
            peer.transceiver = peer.conexao.getTransceivers()[0] ?? null
            if (peer.transceiver) {
              await aplicarStreamLocal(peer.transceiver)
            }
          }
          const resposta = await peer.conexao.createAnswer()
          await peer.conexao.setLocalDescription(resposta)
          enviarSinalRtcRef.current(remetenteId, { type: resposta.type, sdp: resposta.sdp })
        } else if (dados.type === 'answer') {
          await conexoesRef.current.get(remetenteId)?.conexao.setRemoteDescription(dados as RTCSessionDescriptionInit)
        } else if (dados.type === 'renegociar') {
          // pedido do outro lado (ele não pode ofertar - ver `atualizarTransmissaoLocal`) pra eu
          // mandar uma oferta nova, geralmente porque o microfone dele acabou de ligar/desligar.
          const peer = conexoesRef.current.get(remetenteId)
          if (peer && meuUsuarioId !== null && souIniciador(meuUsuarioId, remetenteId)) {
            await ofertar(remetenteId, peer.conexao)
          }
        } else if (dados.candidate !== undefined) {
          // ICE chegando antes da conexão existir de fato (corrida rara com a oferta/resposta, ex.
          // sinal chegou mas o par de voz ainda nem foi calculado deste lado) - descartado de
          // propósito, simplificação aceita: a reconexão seguinte (par muda de novo) recupera.
          await conexoesRef.current.get(remetenteId)?.conexao.addIceCandidate(dados as RTCIceCandidateInit)
        }
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sinaisRtcRecebidos])

  // volume cai com a distância (spatial audio) - recalcula toda vez que alguém se move.
  useEffect(() => {
    conexoesRef.current.forEach((peer, peerId) => {
      const distancia = distanciaPorPeer.get(peerId)
      if (distancia !== undefined) {
        peer.audioEl.volume = calcularVolumePorDistancia(distancia, PROXIMIDADE_RAIO_TILES)
      }
    })
  }, [distanciaPorPeer])

  // detecção simples de "está falando agora" - volume RMS do stream acima de um limiar. Roda
  // sempre (não só com o mic ligado): pedido do usuário é ouvir sempre, então o anel de "falando"
  // de quem está por perto também precisa funcionar mesmo com o meu microfone desligado.
  useEffect(() => {
    const buffer = new Uint8Array(256)
    const intervalo = setInterval(() => {
      const idsFalando = new Set<number>()
      analisadoresRef.current.forEach((analisador, chave) => {
        analisador.getByteTimeDomainData(buffer)
        let somaQuadrados = 0
        for (let i = 0; i < buffer.length; i++) {
          const amostra = (buffer[i] - 128) / 128
          somaQuadrados += amostra * amostra
        }
        const rms = Math.sqrt(somaQuadrados / buffer.length)
        if (rms > LIMIAR_FALANDO) {
          idsFalando.add(chave === 'local' ? (meuUsuarioId ?? -1) : chave)
        }
      })
      setFalando(idsFalando)
    }, INTERVALO_DETECCAO_MS)
    return () => clearInterval(intervalo)
  }, [meuUsuarioId])

  return { falando }
}
