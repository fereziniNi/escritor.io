import { extend, useTick } from '@pixi/react'
import { Container, Graphics } from 'pixi.js'
import { useState } from 'react'
import { desenharPeixinho, desenharSombra, desenharTanqueAquario } from './spriteFactory'
import { TILE_PX } from './constantes'

extend({ Container, Graphics })

/** Cada peixe nada de um lado pro outro do tanque (seno em x, período/fase própria pra não nadar
 * em sincronia com os outros) mais um bobzinho vertical bem sutil. */
const PEIXES = [
  { corCorpo: 0xe8873a, velocidade: 0.0011, fase: 0, amplitude: 12, y: -3 },
  { corCorpo: 0xf2c14e, velocidade: 0.0014, fase: 2.1, amplitude: 9, y: 4 },
]

/**
 * Aquário decorativo animado (Fase 6, pedido do usuário: "nada se move sozinho" era uma queixa
 * concreta) - promovido de detalhe estático dentro de `desenharAquario`/`desenharMobilia` pra um
 * componente próprio com peixe nadando de verdade via `useTick`, mesmo padrão de animação que
 * `AvatarPixi.tsx` já usa. Recebe a posição em TILE (não px) pra bater com o resto de
 * `ItemMobilia`/`CamadaMundo` - a conversão pra px acontece aqui dentro, igual a `desenharMobilia`.
 */
export function AquarioAnimado({ tileX, tileY }: { tileX: number; tileY: number }) {
  const [tempo, setTempo] = useState(0)

  useTick((ticker) => {
    setTempo((atual) => atual + ticker.deltaMS)
  })

  const cx = tileX * TILE_PX + TILE_PX / 2
  const cy = tileY * TILE_PX + TILE_PX / 2

  return (
    <pixiContainer x={cx} y={cy}>
      <pixiGraphics draw={(g) => { g.clear(); desenharSombra(g, 0, 0, TILE_PX * 0.84, TILE_PX * 0.6) }} />
      <pixiGraphics draw={desenharTanqueAquario} />
      {PEIXES.map((peixe, indice) => (
        <pixiGraphics
          key={indice}
          draw={(g) => desenharPeixinho(g, peixe.corCorpo)}
          x={Math.sin(tempo * peixe.velocidade + peixe.fase) * peixe.amplitude}
          y={peixe.y}
          scale={{ x: Math.cos(tempo * peixe.velocidade + peixe.fase) >= 0 ? 1 : -1, y: 1 }}
        />
      ))}
    </pixiContainer>
  )
}
