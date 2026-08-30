import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { criarEnviadorComThrottle } from './throttlePosicao'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('criarEnviadorComThrottle', () => {
  it('envia a primeira posição imediatamente', () => {
    const enviar = vi.fn()
    const agendar = criarEnviadorComThrottle(enviar, 100)

    agendar(1, 2)

    expect(enviar).toHaveBeenCalledExactlyOnceWith(1, 2)
  })

  it('não envia de novo antes da janela de throttle fechar', () => {
    const enviar = vi.fn()
    const agendar = criarEnviadorComThrottle(enviar, 100)

    agendar(1, 2)
    agendar(3, 4)

    expect(enviar).toHaveBeenCalledExactlyOnceWith(1, 2)
  })

  it('envia a última posição pendente assim que a janela fecha (trailing)', () => {
    const enviar = vi.fn()
    const agendar = criarEnviadorComThrottle(enviar, 100)

    agendar(1, 2)
    agendar(3, 4)
    agendar(5, 6)
    vi.advanceTimersByTime(100)

    expect(enviar).toHaveBeenNthCalledWith(1, 1, 2)
    expect(enviar).toHaveBeenNthCalledWith(2, 5, 6)
    expect(enviar).toHaveBeenCalledTimes(2)
  })

  it('depois que a janela fecha, a próxima posição volta a ser enviada imediatamente', () => {
    const enviar = vi.fn()
    const agendar = criarEnviadorComThrottle(enviar, 100)

    agendar(1, 2)
    vi.advanceTimersByTime(100)
    agendar(9, 9)

    expect(enviar).toHaveBeenNthCalledWith(2, 9, 9)
  })
})
