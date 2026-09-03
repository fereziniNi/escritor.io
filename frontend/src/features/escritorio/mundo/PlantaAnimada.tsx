import { extend, useTick } from '@pixi/react'
import type { Container as PixiContainer, Graphics as PixiGraphics } from 'pixi.js'
import { Container, Graphics } from 'pixi.js'
import { useLayoutEffect, useRef } from 'react'
import { desenharPlanta } from './spriteFactory'
import { TILE_PX } from './constantes'

extend({ Container, Graphics })

/** Referência de função estável no módulo (não recriada a cada render/instância) - o desenho em
 * si nunca muda (0,0 sempre), só a `rotation` do container pai balança. */
function desenharPlantaLocal(g: PixiGraphics): void {
  desenharPlanta(g, 0, 0)
}

const VELOCIDADE_BALANCO = 0.0009
const AMPLITUDE_BALANCO_RAD = 0.045

/**
 * Vaso de planta com balanço bem sutil (Fase 6, "nada se move sozinho") - gira ligeiramente em
 * torno da base do vaso via `useTick`, mutando a `rotation` do container direto por `ref` (sem
 * `useState`/re-render nenhum - pedido do usuário depois da Fase 6: "o sistema está muito lento".
 * Com ~15 plantas espalhadas pelo mundo, cada uma fazendo `setState` a cada tick era 15
 * re-renders/frame só de decoração parada; mutação direta no objeto Pixi custa perto de zero).
 */
export function PlantaAnimada({ tileX, tileY }: { tileX: number; tileY: number }) {
  const containerRef = useRef<PixiContainer | null>(null)
  const tempoRef = useRef(0)

  // pivô na base do vaso (não no centro do desenho) - a planta balança pela copa, com o vaso
  // "plantado" no mesmo lugar em qualquer ângulo, do jeito que uma planta de verdade balançaria.
  const baseVasoY = TILE_PX * 0.25
  const cx = tileX * TILE_PX + TILE_PX / 2
  const cy = tileY * TILE_PX + TILE_PX / 2 + baseVasoY

  useLayoutEffect(() => {
    if (containerRef.current) {
      containerRef.current.x = cx
      containerRef.current.y = cy
      containerRef.current.pivot.set(0, baseVasoY)
    }
    // só na montagem - a posição do vaso não muda depois (item estático do mundo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useTick((ticker) => {
    tempoRef.current += ticker.deltaMS
    if (containerRef.current) {
      containerRef.current.rotation = Math.sin(tempoRef.current * VELOCIDADE_BALANCO) * AMPLITUDE_BALANCO_RAD
    }
  })

  return (
    <pixiContainer ref={containerRef}>
      <pixiGraphics draw={desenharPlantaLocal} />
    </pixiContainer>
  )
}
