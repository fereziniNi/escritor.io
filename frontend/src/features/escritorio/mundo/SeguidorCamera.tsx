import { useTick } from '@pixi/react'
import { calcularTransformCamera, suavizarCamera } from './camera'
import type { TransformCamera } from './camera'

/** Fator de suavização por tick - quanto maior, mais "grudada" no jogador (menos atraso visual). */
const FATOR_SUAVIZACAO = 0.15

/**
 * Componente sem saída visual (`return null`) cuja única função é chamar `useTick` a cada frame
 * do Pixi `Ticker` - existe como componente próprio (em vez de um hook comum chamado direto de
 * `CamadaMundo`) porque `useTick`/`useApplication` só enxergam o `PIXI.Application` quando quem
 * chama é um componente que realmente fica *dentro* da árvore de `<Application>` (ver README do
 * `@pixi/react`: chamar esses hooks no mesmo componente que renderiza `<Application>` - que é o
 * caso de `CamadaMundo` - dá "invariant violation"). Isolar num filho de verdade resolve.
 */
export function SeguidorCamera({
  alvoX,
  alvoY,
  larguraMundoPx,
  alturaMundoPx,
  larguraViewportPx,
  alturaViewportPx,
  zoom,
  transformAtual,
  aoAtualizar,
}: {
  alvoX: number
  alvoY: number
  larguraMundoPx: number
  alturaMundoPx: number
  larguraViewportPx: number
  alturaViewportPx: number
  zoom: number
  transformAtual: TransformCamera
  aoAtualizar: (transform: TransformCamera) => void
}) {
  useTick(() => {
    const alvo = calcularTransformCamera({
      jogadorX: alvoX,
      jogadorY: alvoY,
      larguraMundoPx,
      alturaMundoPx,
      larguraViewportPx,
      alturaViewportPx,
      zoom,
    })
    aoAtualizar(suavizarCamera(transformAtual, alvo, FATOR_SUAVIZACAO))
  })

  return null
}
