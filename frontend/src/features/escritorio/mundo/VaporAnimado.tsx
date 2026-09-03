import { extend, useTick } from '@pixi/react'
import { Container, Graphics } from 'pixi.js'
import { useState } from 'react'
import { TILE_PX } from './constantes'

extend({ Container, Graphics })

const DURACAO_CICLO_MS = 2200
/** Cada "baforada" começa num instante diferente do ciclo (spread ao longo de `DURACAO_CICLO_MS`)
 * pra não subir tudo em sincronia - mesmo raciocínio de fase própria por peixe em `AquarioAnimado`. */
const DEFASAGENS_MS = [0, 700, 1450]

function desenharBolha(g: import('pixi.js').Graphics, progresso: number): void {
  g.clear()
  const alpha = Math.sin(progresso * Math.PI) * 0.5
  const raio = 1.5 + progresso * 1.8
  g.circle(0, 0, raio)
  g.fill({ color: 0xffffff, alpha })
}

/**
 * Vapor subindo/desvanecendo em loop sobre um item de café (Fase 6, "nada se move sozinho") -
 * pequenos círculos translúcidos que sobem e crescem levemente enquanto desaparecem, num loop de
 * `DURACAO_CICLO_MS`. Posicionado por cima de um item da zona Café (`cafeteira`/`balcao`) via
 * `tileX`/`tileY`, mesma convenção de tile de `AquarioAnimado`/`PlantaAnimada`.
 */
export function VaporAnimado({ tileX, tileY }: { tileX: number; tileY: number }) {
  const [tempo, setTempo] = useState(0)

  useTick((ticker) => {
    setTempo((atual) => atual + ticker.deltaMS)
  })

  const cx = tileX * TILE_PX + TILE_PX / 2
  const cy = tileY * TILE_PX - TILE_PX * 0.12

  return (
    <pixiContainer x={cx} y={cy}>
      {DEFASAGENS_MS.map((defasagem, indice) => {
        const progresso = ((tempo + defasagem) % DURACAO_CICLO_MS) / DURACAO_CICLO_MS
        return <pixiGraphics key={indice} draw={(g) => desenharBolha(g, progresso)} y={-progresso * TILE_PX * 0.6} />
      })}
    </pixiContainer>
  )
}
