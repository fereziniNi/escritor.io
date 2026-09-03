import { extend, useTick } from '@pixi/react'
import { Container, Graphics } from 'pixi.js'
import { useState } from 'react'
import { desenharPlanta } from './spriteFactory'
import { TILE_PX } from './constantes'

extend({ Container, Graphics })

const VELOCIDADE_BALANCO = 0.0009
const AMPLITUDE_BALANCO_RAD = 0.045

/**
 * Vaso de planta com balanço bem sutil (Fase 6, "nada se move sozinho") - gira ligeiramente em
 * torno da base do vaso via `useTick`, mesmo padrão de `AvatarPixi.tsx`. Recebe posição em TILE
 * (não px), mesma convenção de `AquarioAnimado.tsx`.
 */
export function PlantaAnimada({ tileX, tileY }: { tileX: number; tileY: number }) {
  const [tempo, setTempo] = useState(0)

  useTick((ticker) => {
    setTempo((atual) => atual + ticker.deltaMS)
  })

  const cx = tileX * TILE_PX + TILE_PX / 2
  const cy = tileY * TILE_PX + TILE_PX / 2
  const angulo = Math.sin(tempo * VELOCIDADE_BALANCO) * AMPLITUDE_BALANCO_RAD

  // pivô na base do vaso (não no centro do desenho) - a planta balança pela copa, com o vaso
  // "plantado" no mesmo lugar em qualquer ângulo, do jeito que uma planta de verdade balançaria.
  const baseVasoY = TILE_PX * 0.25

  return (
    <pixiContainer x={cx} y={cy + baseVasoY} pivot={{ x: 0, y: baseVasoY }} rotation={angulo}>
      <pixiGraphics draw={(g) => desenharPlanta(g, 0, 0)} />
    </pixiContainer>
  )
}
