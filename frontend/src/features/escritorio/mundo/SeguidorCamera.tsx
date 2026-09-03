import { useTick } from '@pixi/react'
import { calcularTransformCamera, suavizarCamera } from './camera'
import type { TransformCamera } from './camera'

/** Fator de suavização por tick - quanto maior, mais "grudada" no jogador (menos atraso visual). */
const FATOR_SUAVIZACAO = 0.15

/** Abaixo disso a câmera já convergiu pro alvo (visualmente idêntico) - sem essa checagem,
 * `aoAtualizar` era chamado a cada tick pra sempre (mesmo parado), o que re-renderiza `CamadaMundo`
 * a 60fps o tempo todo e foi a causa real do sistema "travando" depois da Fase 6 (piso/móveis
 * ficaram mais pesados de redesenhar - ver `CamadaMundo.tsx`). Parar de chamar `aoAtualizar` quando
 * já convergiu é o que faz esse custo cair a zero na maior parte do tempo (ninguém andando/dando
 * zoom o tempo inteiro). */
const EPSILON_CONVERGENCIA = 0.01

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
    const proximo = suavizarCamera(transformAtual, alvo, FATOR_SUAVIZACAO)
    const jaConvergiu =
      Math.abs(proximo.x - transformAtual.x) < EPSILON_CONVERGENCIA &&
      Math.abs(proximo.y - transformAtual.y) < EPSILON_CONVERGENCIA &&
      Math.abs(proximo.scale - transformAtual.scale) < EPSILON_CONVERGENCIA
    if (jaConvergiu) {
      return
    }
    aoAtualizar(proximo)
  })

  return null
}
