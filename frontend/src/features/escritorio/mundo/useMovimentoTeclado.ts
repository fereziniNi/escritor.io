import { useEffect } from 'react'
import { calcularProximaPosicao } from './movimento'
import type { PosicaoTile } from './movimento'

const TECLA_PARA_DELTA: Record<string, readonly [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  W: [0, -1],
  s: [0, 1],
  S: [0, 1],
  a: [-1, 0],
  A: [-1, 0],
  d: [1, 0],
  D: [1, 0],
}

/**
 * Move o próprio jogador por seta ou WASD do teclado - substitui o `window` keydown effect que ficava
 * inline em `EscritorioPage.tsx` (mesma lógica de clamp, agora em `calcularProximaPosicao`,
 * puro/testado). `ativo=false` (ex.: um painel do dock aberto) desliga as setas sem precisar
 * desmontar o listener toda hora. Sem colisão pro resto do mapa de propósito (pedido do usuário:
 * "remover as paredes") - `transicaoBloqueada` (opcional) existe pra quando `EscritorioPage.tsx`
 * precisa reintroduzir alguma barreira escopada (pedido posterior: cabines com parede/porta de
 * verdade, ver `construirGradeColisao.ts`), sem afetar o resto do mapa.
 */
export function useMovimentoTeclado({
  ativo,
  posicaoAtual,
  limites,
  mover,
  transicaoBloqueada,
}: {
  ativo: boolean
  posicaoAtual: PosicaoTile | undefined
  limites: { larguraTiles: number; alturaTiles: number }
  mover: (x: number, y: number) => void
  transicaoBloqueada?: (de: PosicaoTile, para: PosicaoTile) => boolean
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
      const proxima = calcularProximaPosicao(posicaoAtual, delta, limites, transicaoBloqueada)
      mover(proxima.x, proxima.y)
    }

    window.addEventListener('keydown', aoPressionarTecla)
    return () => window.removeEventListener('keydown', aoPressionarTecla)
  }, [ativo, posicaoAtual, limites, mover, transicaoBloqueada])
}
