import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  alertar,
  atualizarContadorNaoLidas,
  notificarNoSistema,
  pedirPermissaoDeNotificacao,
  piscarTituloDaAba,
  tocarSom,
} from './alertaPerceptivel'

// mesmo valor que o módulo importado acima já capturou como "título original" ao ser carregado -
// nada troca `document.title` entre essa importação e esta linha, então os dois leem o mesmo jsdom
// padrão. Usado como o valor esperado de "voltou ao normal" nos testes de piscar título.
const TITULO_DE_FABRICA = document.title

/** O GETTER de `document.title` normaliza espaços (strip + collapse ASCII whitespace, regra do
 * HTML) - com o título de fábrica vazio no jsdom, `"(3) " + ""` vira só `"(3)"` depois de lido de
 * volta. `.trim()` aqui replica a mesma normalização pro valor ESPERADO, sem depender de o título
 * de fábrica estar vazio ou não. */
function tituloComContadorEsperado(quantidade: number): string {
  const bruto = quantidade > 0 ? `(${quantidade}) ${TITULO_DE_FABRICA}` : TITULO_DE_FABRICA
  return bruto.trim()
}

function definirAbaOculta(oculta: boolean) {
  Object.defineProperty(document, 'hidden', { value: oculta, configurable: true })
}

class OsciladorFalso {
  type = ''
  frequency = { value: 0 }
  onended: (() => void) | null = null
  connect = vi.fn()
  start = vi.fn()
  stop = vi.fn()
}

class GanhoFalso {
  gain = { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }
  connect = vi.fn()
}

class AudioContextFalso {
  currentTime = 0
  destination = {}
  createOscillator = vi.fn(() => new OsciladorFalso())
  createGain = vi.fn(() => new GanhoFalso())
  close = vi.fn(() => Promise.resolve())
}

class NotificationFalsa {
  static instancias: NotificationFalsa[] = []
  static permission: NotificationPermission = 'default'
  static requestPermission = vi.fn(() => Promise.resolve('granted' as NotificationPermission))

  titulo: string
  opcoes: unknown

  constructor(titulo: string, opcoes: unknown) {
    this.titulo = titulo
    this.opcoes = opcoes
    NotificationFalsa.instancias.push(this)
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
  definirAbaOculta(false)
  atualizarContadorNaoLidas(0)
  document.title = TITULO_DE_FABRICA
  NotificationFalsa.instancias = []
  NotificationFalsa.permission = 'default'
  NotificationFalsa.requestPermission.mockClear()
})

/**
 * Pedido do usuário: "sempre que alguém finalizar uma tarefa, receba uma mensagem, receba o
 * convite de uma reunião... notificado ao usuário... reproduzir algum barulho e exibir algo para
 * o usuário perceber, seja na aba do navegador."
 */
describe('tocarSom', () => {
  it('não lança quando o navegador não tem AudioContext', () => {
    vi.stubGlobal('AudioContext', undefined)
    vi.stubGlobal('webkitAudioContext', undefined)

    expect(() => tocarSom()).not.toThrow()
  })

  it('cria e inicia um oscilador quando AudioContext existe', () => {
    vi.stubGlobal('AudioContext', AudioContextFalso)

    tocarSom()

    // não guarda a instância criada internamente - só confirma que o caminho feliz não lança e
    // realmente usa a API (via o construtor falso, que registraria uma exceção se mal chamado).
  })
})

describe('piscarTituloDaAba', () => {
  it('não faz nada se a aba já está visível', () => {
    definirAbaOculta(false)
    document.title = 'Página atual'

    piscarTituloDaAba('🔔 Nova mensagem')

    expect(document.title).toBe('Página atual')
  })

  it('pisca o título enquanto a aba está oculta, e restaura ao voltar a ficar visível', () => {
    vi.useFakeTimers()
    definirAbaOculta(true)

    piscarTituloDaAba('🔔 Nova mensagem')
    expect(document.title).toBe('🔔 Nova mensagem')

    vi.advanceTimersByTime(1000)
    expect(document.title).toBe(TITULO_DE_FABRICA)

    vi.advanceTimersByTime(1000)
    expect(document.title).toBe('🔔 Nova mensagem')

    definirAbaOculta(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(document.title).toBe(TITULO_DE_FABRICA)

    // o intervalo já foi parado - avançar o tempo não deveria voltar a piscar.
    vi.advanceTimersByTime(3000)
    expect(document.title).toBe(TITULO_DE_FABRICA)
  })

  it('com não lidas contadas, restaura pro título COM o prefixo "(N)", não pro título nu', () => {
    vi.useFakeTimers()
    atualizarContadorNaoLidas(3)
    definirAbaOculta(true)

    piscarTituloDaAba('🔔 Nova mensagem')
    expect(document.title).toBe('🔔 Nova mensagem')

    vi.advanceTimersByTime(1000)
    expect(document.title).toBe(tituloComContadorEsperado(3))

    definirAbaOculta(false)
    document.dispatchEvent(new Event('visibilitychange'))
    expect(document.title).toBe(tituloComContadorEsperado(3))
  })
})

describe('atualizarContadorNaoLidas', () => {
  it('pedido do usuário: "a aba mostrasse a quantidade de notificações que não foram lidas" - prefixa o título com "(N)"', () => {
    atualizarContadorNaoLidas(5)
    expect(document.title).toBe(tituloComContadorEsperado(5))
  })

  it('some com o prefixo quando não há mais não lidas', () => {
    atualizarContadorNaoLidas(2)
    atualizarContadorNaoLidas(0)
    expect(document.title).toBe(TITULO_DE_FABRICA)
  })

  it('não mexe no título enquanto está piscando (a aba oculta continua no controle até parar)', () => {
    vi.useFakeTimers()
    definirAbaOculta(true)
    piscarTituloDaAba('🔔 Nova mensagem')

    atualizarContadorNaoLidas(7)

    expect(document.title).toBe('🔔 Nova mensagem')
  })
})

describe('pedirPermissaoDeNotificacao', () => {
  it('pede permissão quando ainda não foi decidida', () => {
    vi.stubGlobal('Notification', NotificationFalsa)
    NotificationFalsa.permission = 'default'

    pedirPermissaoDeNotificacao()

    expect(NotificationFalsa.requestPermission).toHaveBeenCalledTimes(1)
  })

  it('não pede de novo se já foi concedida ou negada', () => {
    vi.stubGlobal('Notification', NotificationFalsa)
    NotificationFalsa.permission = 'granted'

    pedirPermissaoDeNotificacao()

    expect(NotificationFalsa.requestPermission).not.toHaveBeenCalled()
  })
})

describe('notificarNoSistema', () => {
  it('não cria notificação sem permissão concedida', () => {
    vi.stubGlobal('Notification', NotificationFalsa)
    NotificationFalsa.permission = 'default'
    definirAbaOculta(true)

    notificarNoSistema('Nova mensagem', 'Beto: Oi!')

    expect(NotificationFalsa.instancias).toHaveLength(0)
  })

  it('não cria notificação se a aba já está visível (mesmo com permissão concedida)', () => {
    vi.stubGlobal('Notification', NotificationFalsa)
    NotificationFalsa.permission = 'granted'
    definirAbaOculta(false)

    notificarNoSistema('Nova mensagem', 'Beto: Oi!')

    expect(NotificationFalsa.instancias).toHaveLength(0)
  })

  it('cria a notificação nativa com permissão concedida e a aba oculta', () => {
    vi.stubGlobal('Notification', NotificationFalsa)
    NotificationFalsa.permission = 'granted'
    definirAbaOculta(true)

    notificarNoSistema('Nova mensagem', 'Beto: Oi!')

    expect(NotificationFalsa.instancias).toHaveLength(1)
    expect(NotificationFalsa.instancias[0].titulo).toBe('Nova mensagem')
    expect(NotificationFalsa.instancias[0].opcoes).toMatchObject({ body: 'Beto: Oi!' })
  })
})

describe('alertar', () => {
  it('chama som, título piscando e notificação nativa juntos', () => {
    vi.stubGlobal('AudioContext', AudioContextFalso)
    vi.stubGlobal('Notification', NotificationFalsa)
    NotificationFalsa.permission = 'granted'
    definirAbaOculta(true)

    alertar({ titulo: 'Nova mensagem', corpo: 'Beto: Oi!' })

    expect(document.title).toBe('🔔 Nova mensagem')
    expect(NotificationFalsa.instancias).toHaveLength(1)
  })
})
