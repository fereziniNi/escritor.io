import { useEffect } from 'react'
import { calcularProximaPosicao } from './movimento'
import type { PosicaoTile } from './movimento'

const TECLA_PARA_DELTA: Record<string, readonly [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
}

/**
 * Move o próprio jogador por seta do teclado - substitui o `window` keydown effect que ficava
 * inline em `EscritorioPage.tsx` (mesma lógica de clamp, agora em `calcularProximaPosicao`,
 * puro/testado). `ativo=false` (ex.: um painel do dock aberto) desliga as setas sem precisar
 * desmontar o listener toda hora.
 */
export function useMovimentoTeclado({
  ativo,
  posicaoAtual,
  limites,
  mover,
}: {
  ativo: boolean
  posicaoAtual: PosicaoTile | undefined
  limites: { larguraTiles: number; alturaTiles: number }
  mover: (x: number, y: number) => void
}) {
  useEffect(() => {
    if (!ativo || !posicaoAtual) {
      return undefined
    }

    function aoPressionarTecla(evento: KeyboardEvent) {
      const delta = TECLA_PARA_DELTA[evento.key]
      if (!delta || !posicaoAtual) {
        return
      }
      evento.preventDefault()
      const proxima = calcularProximaPosicao(posicaoAtual, delta, limites)
      mover(proxima.x, proxima.y)
    }

    window.addEventListener('keydown', aoPressionarTecla)
    return () => window.removeEventListener('keydown', aoPressionarTecla)
  }, [ativo, posicaoAtual, limites, mover])
}
