import { extend, useTick } from '@pixi/react'
import type { Container as PixiContainer, Graphics as PixiGraphics } from 'pixi.js'
import { Container, Graphics } from 'pixi.js'
import { useLayoutEffect, useRef } from 'react'
import { TILE_PX } from './constantes'

extend({ Container, Graphics })

const DURACAO_CICLO_MS = 2200
/** Cada "baforada" começa num instante diferente do ciclo (spread ao longo de `DURACAO_CICLO_MS`)
 * pra não subir tudo em sincronia - mesmo raciocínio de fase própria por peixe em `AquarioAnimado`. */
const DEFASAGENS_MS = [0, 700, 1450]

/** `pixiGraphics` exige um `draw` inicial - o desenho de verdade acontece via `ref` no `useTick`
 * (o raio/alpha mudam a cada frame), então este é só o "geometry vazio" da 1ª montagem. */
function semDesenhoInicial(): void {}

function desenharBolha(g: PixiGraphics, progresso: number): void {
  g.clear()
  const alpha = Math.sin(progresso * Math.PI) * 0.5
  const raio = 1.5 + progresso * 1.8
  g.circle(0, 0, raio)
  g.fill({ color: 0xffffff, alpha })
}

/**
 * Vapor subindo/desvanecendo em loop sobre um item de café (Fase 6, "nada se move sozinho") -
 * pequenos círculos translúcidos que sobem e crescem levemente enquanto desaparecem. Perf (pedido
 * seguinte do usuário: "o sistema está muito lento"): a bolha em si PRECISA redesenhar a cada tick
 * (o raio/alpha mudam de verdade, diferente de peixe/planta que só movem/giram) - mas isso é
 * chamado direto no `ref` do próprio `Graphics`, sem `useState`/re-render do React nenhum (só 3
 * círculos pequenos, redesenho em si é barato; o caro era o re-render em cascata que `setState`
 * a cada tick causava).
 */
export function VaporAnimado({ tileX, tileY }: { tileX: number; tileY: number }) {
  const containerRef = useRef<PixiContainer | null>(null)
  const bolhaRefs = useRef<(PixiGraphics | null)[]>([])
  const tempoRef = useRef(0)

  const cx = tileX * TILE_PX + TILE_PX / 2
  const cy = tileY * TILE_PX - TILE_PX * 0.12

  useLayoutEffect(() => {
    if (containerRef.current) {
      containerRef.current.x = cx
      containerRef.current.y = cy
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useTick((ticker) => {
    tempoRef.current += ticker.deltaMS
    for (let indice = 0; indice < DEFASAGENS_MS.length; indice++) {
      const grafico = bolhaRefs.current[indice]
      if (!grafico) continue
      const progresso = ((tempoRef.current + DEFASAGENS_MS[indice]) % DURACAO_CICLO_MS) / DURACAO_CICLO_MS
      desenharBolha(grafico, progresso)
      grafico.y = -progresso * TILE_PX * 0.6
    }
  })

  return (
    <pixiContainer ref={containerRef}>
      {DEFASAGENS_MS.map((_, indice) => (
        <pixiGraphics
          key={indice}
          ref={(g) => {
            bolhaRefs.current[indice] = g
          }}
          draw={semDesenhoInicial}
        />
      ))}
    </pixiContainer>
  )
}
