import { renderHook } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DURACAO_GLIDE_MS } from './glide'
import { useMovimentoTeclado } from './useMovimentoTeclado'

function pressionar(tecla: string): KeyboardEvent {
  const evento = new KeyboardEvent('keydown', { key: tecla, cancelable: true })
  window.dispatchEvent(evento)
  return evento
}

function soltar(tecla: string) {
  window.dispatchEvent(new KeyboardEvent('keyup', { key: tecla }))
}

const LIMITES = { larguraTiles: 20, alturaTiles: 15 }

/**
 * Pedido do usuário: "a movimentação do personagem está travando muito... aparenta estar com um
 * ping alto... quero que a locomoção seja flúida". A causa real era o hook depender do key-repeat
 * bruto do navegador (atraso inicial alto, depois dispara numa cadência que o SO escolhe) - esses
 * testes travam o comportamento novo: teclas seguradas de verdade (`keydown`/`keyup`) andam em
 * passos de intervalo fixo próprio, independente de qualquer key-repeat.
 */
describe('useMovimentoTeclado', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('a primeira pressão move na hora, sem esperar o intervalo', () => {
    const mover = vi.fn()
    renderHook(() =>
      useMovimentoTeclado({ ativo: true, posicaoAtual: { x: 5, y: 5 }, limites: LIMITES, mover }),
    )

    act(() => pressionar('ArrowRight'))

    expect(mover).toHaveBeenCalledTimes(1)
    expect(mover).toHaveBeenCalledWith(6, 5)
  })

  it('segurar a tecla anda em passos contínuos no intervalo fixo, não no key-repeat do navegador', () => {
    const mover = vi.fn()
    renderHook(() =>
      useMovimentoTeclado({ ativo: true, posicaoAtual: { x: 5, y: 5 }, limites: LIMITES, mover }),
    )

    act(() => pressionar('ArrowRight')) // passo imediato: mover(6, 5)
    act(() => vi.advanceTimersByTime(DURACAO_GLIDE_MS)) // segundo passo do loop

    expect(mover).toHaveBeenCalledTimes(2)
    expect(mover).toHaveBeenNthCalledWith(2, 6, 5) // posicaoAtual do teste não muda, mas o passo saiu
  })

  it('keydown repetido da mesma tecla (key-repeat do SO) não gera passo extra - só o loop mesmo', () => {
    const mover = vi.fn()
    renderHook(() =>
      useMovimentoTeclado({ ativo: true, posicaoAtual: { x: 5, y: 5 }, limites: LIMITES, mover }),
    )

    act(() => pressionar('ArrowRight')) // passo imediato
    act(() => pressionar('ArrowRight')) // o navegador reenvia o mesmo keydown - ignorado
    act(() => pressionar('ArrowRight'))

    expect(mover).toHaveBeenCalledTimes(1)
  })

  it('soltar a tecla para o loop de passos', () => {
    const mover = vi.fn()
    renderHook(() =>
      useMovimentoTeclado({ ativo: true, posicaoAtual: { x: 5, y: 5 }, limites: LIMITES, mover }),
    )

    act(() => pressionar('ArrowRight'))
    act(() => soltar('ArrowRight'))
    mover.mockClear()

    act(() => vi.advanceTimersByTime(DURACAO_GLIDE_MS * 3))

    expect(mover).not.toHaveBeenCalled()
  })

  it('perder o foco da janela solta tudo, mesmo sem o keyup chegar', () => {
    const mover = vi.fn()
    renderHook(() =>
      useMovimentoTeclado({ ativo: true, posicaoAtual: { x: 5, y: 5 }, limites: LIMITES, mover }),
    )

    act(() => pressionar('ArrowRight'))
    act(() => window.dispatchEvent(new Event('blur')))
    mover.mockClear()

    act(() => vi.advanceTimersByTime(DURACAO_GLIDE_MS * 3))

    expect(mover).not.toHaveBeenCalled()
  })

  it('ativo=false não move nada', () => {
    const mover = vi.fn()
    renderHook(() =>
      useMovimentoTeclado({ ativo: false, posicaoAtual: { x: 5, y: 5 }, limites: LIMITES, mover }),
    )

    act(() => pressionar('ArrowRight'))
    act(() => vi.advanceTimersByTime(DURACAO_GLIDE_MS * 3))

    expect(mover).not.toHaveBeenCalled()
  })

  it('respeita transicaoBloqueada, igual à versão orientada a evento único', () => {
    const mover = vi.fn()
    const transicaoBloqueada = vi.fn().mockReturnValue(true)
    renderHook(() =>
      useMovimentoTeclado({ ativo: true, posicaoAtual: { x: 5, y: 5 }, limites: LIMITES, mover, transicaoBloqueada }),
    )

    act(() => pressionar('ArrowRight'))

    expect(transicaoBloqueada).toHaveBeenCalledWith({ x: 5, y: 5 }, { x: 6, y: 5 })
    expect(mover).toHaveBeenCalledWith(5, 5) // bloqueado - fica onde está
  })

  /** Pedido do usuário: "as letras do wasd não estão saindo no chat" - o listener é no `window`,
   * então sem essa checagem ele capturava W/A/S/D digitados em qualquer campo de texto focado. */
  it('ignora WASD/setas (sem mexer no personagem, sem bloquear a tecla) quando um campo de texto está focado', () => {
    const mover = vi.fn()
    renderHook(() =>
      useMovimentoTeclado({ ativo: true, posicaoAtual: { x: 5, y: 5 }, limites: LIMITES, mover }),
    )

    const campo = document.createElement('input')
    document.body.appendChild(campo)
    campo.focus()

    let evento: KeyboardEvent | undefined
    act(() => {
      evento = pressionar('d')
    })

    expect(mover).not.toHaveBeenCalled()
    expect(evento?.defaultPrevented).toBe(false) // a letra "d" chega no campo normalmente

    document.body.removeChild(campo)
  })

  it('volta a mover o personagem depois que o campo de texto perde o foco', () => {
    const mover = vi.fn()
    renderHook(() =>
      useMovimentoTeclado({ ativo: true, posicaoAtual: { x: 5, y: 5 }, limites: LIMITES, mover }),
    )

    const campo = document.createElement('input')
    document.body.appendChild(campo)
    campo.focus()
    act(() => pressionar('d'))
    expect(mover).not.toHaveBeenCalled()

    campo.blur()
    document.body.removeChild(campo)
    act(() => pressionar('ArrowRight'))

    expect(mover).toHaveBeenCalledWith(6, 5)
  })

  it('desmontar o componente para o loop de passos', () => {
    const mover = vi.fn()
    const { unmount } = renderHook(() =>
      useMovimentoTeclado({ ativo: true, posicaoAtual: { x: 5, y: 5 }, limites: LIMITES, mover }),
    )

    act(() => pressionar('ArrowRight'))
    unmount()
    mover.mockClear()

    act(() => vi.advanceTimersByTime(DURACAO_GLIDE_MS * 3))

    expect(mover).not.toHaveBeenCalled()
  })
})
