import { extend, useTick } from '@pixi/react'
import type { Container as PixiContainer, Graphics as PixiGraphics } from 'pixi.js'
import { Container, Graphics } from 'pixi.js'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { desenharPeixinho, desenharSombra, desenharTanqueAquario } from './spriteFactory'
import { TILE_PX } from './constantes'

extend({ Container, Graphics })

/** Cada peixe nada de um lado pro outro do tanque (seno em x, período/fase própria pra não nadar
 * em sincronia com os outros) mais um bobzinho vertical bem sutil. */
const PEIXES = [
  { corCorpo: 0xe8873a, velocidade: 0.0011, fase: 0, amplitude: 12, y: -3 },
  { corCorpo: 0xf2c14e, velocidade: 0.0014, fase: 2.1, amplitude: 9, y: 4 },
]

function desenharSombraTanque(g: PixiGraphics): void {
  g.clear()
  desenharSombra(g, 0, 0, TILE_PX * 0.84, TILE_PX * 0.6)
}

/**
 * Aquário decorativo animado (Fase 6, pedido do usuário: "nada se move sozinho" era uma queixa
 * concreta) - peixe nadando de verdade via `useTick`. Perf (pedido seguinte: "o sistema está
 * muito lento"): nada aqui passa por `useState` - a "natação" é mutação direta de `x`/`y`/`scale.x`
 * de cada `Graphics` de peixe via `ref`, sem re-render nenhum do React a cada tick (mesmo padrão
 * de `AvatarPixi.tsx`/`PlantaAnimada.tsx`). Recebe a posição em TILE (não px), mesma convenção do
 * resto de `ItemMobilia`/`CamadaMundo`.
 */
export function AquarioAnimado({ tileX, tileY }: { tileX: number; tileY: number }) {
  const containerRef = useRef<PixiContainer | null>(null)
  const peixeRefs = useRef<(PixiGraphics | null)[]>([])
  const tempoRef = useRef(0)
  // referência estável por peixe (não recriada a cada render) - o desenho em si nunca muda, só
  // x/y/scale via ref no `useTick` acima.
  const desenharPeixesMemo = useMemo(() => PEIXES.map((peixe) => (g: PixiGraphics) => desenharPeixinho(g, peixe.corCorpo)), [])

  const cx = tileX * TILE_PX + TILE_PX / 2
  const cy = tileY * TILE_PX + TILE_PX / 2

  useLayoutEffect(() => {
    if (containerRef.current) {
      containerRef.current.x = cx
      containerRef.current.y = cy
    }
    // só na montagem - a posição do aquário não muda depois (item estático do mundo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useTick((ticker) => {
    tempoRef.current += ticker.deltaMS
    for (let indice = 0; indice < PEIXES.length; indice++) {
      const peixe = PEIXES[indice]
      const grafico = peixeRefs.current[indice]
      if (!grafico) continue
      const fase = tempoRef.current * peixe.velocidade + peixe.fase
      grafico.x = Math.sin(fase) * peixe.amplitude
      grafico.y = peixe.y
      grafico.scale.x = Math.cos(fase) >= 0 ? 1 : -1
    }
  })

  return (
    <pixiContainer ref={containerRef}>
      <pixiGraphics draw={desenharSombraTanque} />
      <pixiGraphics draw={desenharTanqueAquario} />
      {PEIXES.map((_, indice) => (
        <pixiGraphics
          key={indice}
          ref={(g) => {
            peixeRefs.current[indice] = g
          }}
          draw={desenharPeixesMemo[indice]}
        />
      ))}
    </pixiContainer>
  )
}
