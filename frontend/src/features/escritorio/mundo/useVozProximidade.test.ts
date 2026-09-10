import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SinalRtcRecebido } from '../types'
import type { ParProximo } from './proximidade'
import { souIniciador, useVozProximidade } from './useVozProximidade'

/** jsdom não implementa `RTCPeerConnection`/Web Audio - fakes leves, mesmo espírito do
 * `WebSocketFalso` já usado em `usePresencaWebSocket.test.tsx`. Só o suficiente pra confirmar a
 * orquestração (quem oferece, pra quem manda o quê, quando fecha, quando só troca a track) - o
 * WebRTC de verdade (ICE/SDP/mídia) só é verificado ao vivo (Playwright, dois browsers,
 * `--use-fake-device-for-media-stream`). */
class RTCRtpTransceiverFalso {
  direction: string
  sender: { track: unknown; replaceTrack: (track: unknown) => Promise<void> }

  constructor(direction: string) {
    this.direction = direction
    this.sender = {
      track: null,
      replaceTrack: async (track: unknown) => {
        this.sender.track = track
      },
    }
  }
}

class RTCPeerConnectionFalsa {
  static instancias: RTCPeerConnectionFalsa[] = []

  onicecandidate: ((evento: { candidate: unknown }) => void) | null = null
  ontrack: ((evento: { streams: MediaStream[] }) => void) | null = null
  onconnectionstatechange: (() => void) | null = null
  connectionState = 'new'
  signalingState = 'stable'
  localDescription: unknown = null
  remoteDescription: unknown = null
  fechada = false
  transceivers: RTCRtpTransceiverFalso[] = []
  config: unknown

  constructor(config: unknown) {
    this.config = config
    RTCPeerConnectionFalsa.instancias.push(this)
  }

  addTransceiver(_tipo: string, opcoes: { direction: string }) {
    const transceiver = new RTCRtpTransceiverFalso(opcoes.direction)
    this.transceivers.push(transceiver)
    return transceiver
  }

  getTransceivers() {
    return this.transceivers
  }

  async createOffer() {
    return { type: 'offer' as const, sdp: 'oferta-falsa' }
  }

  async createAnswer() {
    return { type: 'answer' as const, sdp: 'resposta-falsa' }
  }

  async setLocalDescription(descricao: unknown) {
    this.localDescription = descricao
  }

  async setRemoteDescription(descricao: { type?: string } | null) {
    this.remoteDescription = descricao
    // o navegador de verdade cria um transceiver pra casar com o m-line recebido quando o lado
    // que responde não criou nenhum de propósito (ver comentário em `criarConexao` no hook) -
    // simula isso aqui, senão o fake nunca teria transceiver nenhum pro lado que só responde.
    if (descricao?.type === 'offer' && this.transceivers.length === 0) {
      this.transceivers.push(new RTCRtpTransceiverFalso('recvonly'))
    }
  }

  async addIceCandidate() {
    // no-op - não precisamos simular ICE de verdade pra testar a orquestração
  }

  close() {
    this.fechada = true
    this.connectionState = 'closed'
  }
}

class AnalyserNodeFalso {
  fftSize = 512
  getByteTimeDomainData(buffer: Uint8Array) {
    buffer.fill(128) // silêncio (128 = zero na escala de 0-255 do getByteTimeDomainData)
  }
}

class AudioContextFalso {
  createAnalyser() {
    return new AnalyserNodeFalso()
  }
  createMediaStreamSource() {
    return { connect: vi.fn() }
  }
}

function streamFalsa(): MediaStream {
  const track = { stop: vi.fn(), kind: 'audio' }
  return { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream
}

const getUserMediaMock = vi.fn().mockResolvedValue(undefined)

beforeEach(() => {
  RTCPeerConnectionFalsa.instancias = []
  vi.stubGlobal('RTCPeerConnection', RTCPeerConnectionFalsa)
  vi.stubGlobal('AudioContext', AudioContextFalso)
  getUserMediaMock.mockReset().mockResolvedValue(streamFalsa())
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: getUserMediaMock },
    configurable: true,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('souIniciador', () => {
  it('quem tem o usuarioId menor é sempre quem oferece primeiro - evita as duas pontas ofertando ao mesmo tempo', () => {
    expect(souIniciador(1, 2)).toBe(true)
    expect(souIniciador(2, 1)).toBe(false)
  })
})

interface Props {
  pares: ParProximo[]
  ativo: boolean
  sinais: SinalRtcRecebido[]
}

function renderVoz(meuUsuarioId: number, props: Props) {
  const enviarSinalRtc = vi.fn()
  const view = renderHook(
    (p: Props) =>
      useVozProximidade({ meuUsuarioId, ativo: p.ativo, paresDeVoz: p.pares, sinaisRtcRecebidos: p.sinais, enviarSinalRtc }),
    { initialProps: props },
  )
  return { ...view, enviarSinalRtc }
}

describe('useVozProximidade', () => {
  it('pedido do usuário: "voice... com a pessoa mais próxima" - par de voz com mic ativo cria conexão e, sendo o id menor, eu ofereço', async () => {
    const par: ParProximo = { usuarioIdA: 1, usuarioIdB: 2, distanciaTiles: 1 }
    const { enviarSinalRtc } = renderVoz(1, { pares: [par], ativo: true, sinais: [] })

    await waitFor(() => expect(RTCPeerConnectionFalsa.instancias).toHaveLength(1))
    await waitFor(() => expect(enviarSinalRtc).toHaveBeenCalledWith(2, expect.objectContaining({ type: 'offer' })))
  })

  it('quando o outro usuário tem o id menor, eu não ofereço primeiro - a conexão fica pronta, mas esperando a oferta dele', async () => {
    const par: ParProximo = { usuarioIdA: 2, usuarioIdB: 5, distanciaTiles: 1 }
    const { enviarSinalRtc } = renderVoz(5, { pares: [par], ativo: true, sinais: [] })

    // a conexão local nasce dos dois lados (cada navegador cria o próprio `RTCPeerConnection` -
    // é o mesmo objeto lógico sincronizado por SDP/ICE, não um objeto só compartilhado) - o que
    // não pode acontecer é EU mandar uma oferta, já que meu id (5) é maior que o do par (2).
    await waitFor(() => expect(RTCPeerConnectionFalsa.instancias).toHaveLength(1))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(enviarSinalRtc).not.toHaveBeenCalledWith(2, expect.objectContaining({ type: 'offer' }))
  })

  it('pedido do usuário: "podemos falar dentro da sala" - recebe uma oferta e responde pro remetente certo', async () => {
    const { rerender, enviarSinalRtc } = renderVoz(5, { pares: [], ativo: true, sinais: [] })
    await waitFor(() => expect(getUserMediaMock).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve, 10)) // dá tempo do stream "resolver"

    const sinais: SinalRtcRecebido[] = [{ remetenteId: 2, sinal: { type: 'offer', sdp: 'oferta-de-fora' } }]
    rerender({ pares: [], ativo: true, sinais })

    await waitFor(() => expect(RTCPeerConnectionFalsa.instancias).toHaveLength(1))
    await waitFor(() => expect(enviarSinalRtc).toHaveBeenCalledWith(2, expect.objectContaining({ type: 'answer' })))
  })

  it('sair do par de voz fecha a conexão correspondente', async () => {
    const par: ParProximo = { usuarioIdA: 1, usuarioIdB: 2, distanciaTiles: 1 }
    const { rerender } = renderVoz(1, { pares: [par], ativo: true, sinais: [] })
    await waitFor(() => expect(RTCPeerConnectionFalsa.instancias).toHaveLength(1))
    const conexao = RTCPeerConnectionFalsa.instancias[0]

    rerender({ pares: [], ativo: true, sinais: [] })

    await waitFor(() => expect(conexao.fechada).toBe(true))
  })

  it('nunca pede o microfone enquanto o mic está desligado (opt-in de verdade)', () => {
    renderVoz(1, { pares: [{ usuarioIdA: 1, usuarioIdB: 2, distanciaTiles: 1 }], ativo: false, sinais: [] })
    expect(getUserMediaMock).not.toHaveBeenCalled()
  })

  it('pedido do usuário: "o microfone deve ter o som ligado sempre" - a conexão nasce mesmo com o microfone desligado, pronta pra ouvir (recvonly)', async () => {
    const par: ParProximo = { usuarioIdA: 1, usuarioIdB: 2, distanciaTiles: 1 }
    renderVoz(1, { pares: [par], ativo: false, sinais: [] })

    await waitFor(() => expect(RTCPeerConnectionFalsa.instancias).toHaveLength(1))
    expect(getUserMediaMock).not.toHaveBeenCalled()
    expect(RTCPeerConnectionFalsa.instancias[0].transceivers[0].direction).toBe('recvonly')
  })

  it('pedido do usuário: "só o microfone que deve estar disponível para ligar e desligar" - desligar o microfone NÃO fecha a conexão, só para de transmitir', async () => {
    const par: ParProximo = { usuarioIdA: 1, usuarioIdB: 2, distanciaTiles: 1 }
    const { rerender } = renderVoz(1, { pares: [par], ativo: true, sinais: [] })
    await waitFor(() => expect(RTCPeerConnectionFalsa.instancias).toHaveLength(1))
    const conexao = RTCPeerConnectionFalsa.instancias[0]
    await waitFor(() => expect(conexao.transceivers[0].direction).toBe('sendrecv'))

    rerender({ pares: [par], ativo: false, sinais: [] })

    await waitFor(() => expect(conexao.transceivers[0].direction).toBe('recvonly'))
    expect(conexao.transceivers[0].sender.track).toBeNull()
    expect(conexao.fechada).toBe(false)
  })

  it('ligar o microfone depois de já estar no par (sendo quem inicia) começa a transmitir e manda oferta nova sem recriar a conexão', async () => {
    const par: ParProximo = { usuarioIdA: 1, usuarioIdB: 2, distanciaTiles: 1 }
    const { rerender, enviarSinalRtc } = renderVoz(1, { pares: [par], ativo: false, sinais: [] })
    await waitFor(() => expect(RTCPeerConnectionFalsa.instancias).toHaveLength(1))
    const conexao = RTCPeerConnectionFalsa.instancias[0]
    expect(conexao.transceivers[0].direction).toBe('recvonly')
    enviarSinalRtc.mockClear()

    rerender({ pares: [par], ativo: true, sinais: [] })

    await waitFor(() => expect(conexao.transceivers[0].direction).toBe('sendrecv'))
    expect(conexao.transceivers[0].sender.track).not.toBeNull()
    // mesma conexão (a de antes), não uma nova - só renegociou.
    expect(RTCPeerConnectionFalsa.instancias).toHaveLength(1)
    await waitFor(() => expect(enviarSinalRtc).toHaveBeenCalledWith(2, expect.objectContaining({ type: 'offer' })))
  })

  it('ligar o microfone quando NÃO sou quem inicia pede renegociação em vez de ofertar direto (evita colisão)', async () => {
    // meuUsuarioId 5 > 2 - não sou o iniciador desse par (`souIniciador`).
    const par: ParProximo = { usuarioIdA: 2, usuarioIdB: 5, distanciaTiles: 1 }
    const sinais: SinalRtcRecebido[] = [{ remetenteId: 2, sinal: { type: 'offer', sdp: 'oferta-de-fora' } }]
    const { rerender, enviarSinalRtc } = renderVoz(5, { pares: [par], ativo: false, sinais })
    await waitFor(() => expect(RTCPeerConnectionFalsa.instancias).toHaveLength(1))
    const conexao = RTCPeerConnectionFalsa.instancias[0]
    // a oferta inicial (de quem inicia, 2) já precisa ter sido processada - só depois disso existe
    // um transceiver de verdade pra atualizar (ver comentário em `criarConexao` no hook).
    await waitFor(() => expect(conexao.transceivers).toHaveLength(1))
    enviarSinalRtc.mockClear()

    rerender({ pares: [par], ativo: true, sinais })

    // a track/direção local já mudam - só não é ELE quem manda a oferta.
    await waitFor(() => expect(conexao.transceivers[0].direction).toBe('sendrecv'))
    await waitFor(() => expect(enviarSinalRtc).toHaveBeenCalledWith(2, { type: 'renegociar' }))
    expect(enviarSinalRtc).not.toHaveBeenCalledWith(2, expect.objectContaining({ type: 'offer' }))
  })

  it('recebe um pedido de renegociação e responde com uma oferta nova (só quando eu sou quem inicia)', async () => {
    const par: ParProximo = { usuarioIdA: 1, usuarioIdB: 2, distanciaTiles: 1 }
    const { rerender, enviarSinalRtc } = renderVoz(1, { pares: [par], ativo: false, sinais: [] })
    await waitFor(() => expect(RTCPeerConnectionFalsa.instancias).toHaveLength(1))
    enviarSinalRtc.mockClear()

    const sinais: SinalRtcRecebido[] = [{ remetenteId: 2, sinal: { type: 'renegociar' } }]
    rerender({ pares: [par], ativo: false, sinais })

    await waitFor(() => expect(enviarSinalRtc).toHaveBeenCalledWith(2, expect.objectContaining({ type: 'offer' })))
  })
})
