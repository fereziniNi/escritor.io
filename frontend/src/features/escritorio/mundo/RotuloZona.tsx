import type { Graphics as PixiGraphics } from 'pixi.js'
import { ICONE_ZONA } from '../icones'
import type { Zona } from '../types'
import { TILE_PX } from './constantes'

const LARGURA_ROTULO = 210
const ALTURA_ROTULO = 34
const COR_FUNDO = 0x1c1c28
const ALPHA_FUNDO = 0.95
const COR_BORDA = 0xffffff

function desenharFundoRotulo(g: PixiGraphics): void {
  g.clear()
  g.roundRect(-LARGURA_ROTULO / 2, -ALTURA_ROTULO / 2, LARGURA_ROTULO, ALTURA_ROTULO, 14)
  g.fill({ color: COR_FUNDO, alpha: ALPHA_FUNDO })
  g.stroke({ width: 1.5, color: COR_BORDA, alpha: 0.35 })
}

/**
 * Identificação de sala flutuando sobre o mapa (pedido do usuário: "uma identificação de cada
 * lugar do mapa" - depois reforçado com "os nomes... estão muito difícil de enxergar, deixe mais
 * nítido"). Pílula bem opaca + borda clara sutil pra destacar do piso claro/azulado por baixo, e o
 * próprio texto ganha um contorno escuro grosso em cima do fill branco (dupla camada de contraste,
 * não só a cor do fundo) - mesmo princípio da etiqueta de nome do avatar em `AvatarPixi.tsx`, num
 * tamanho de fonte maior por ser uma leitura "de relance" no mapa, não em cima de alguém.
 */
export function RotuloZona({ zona }: { zona: Zona }) {
  const x = (zona.x + zona.largura / 2) * TILE_PX
  const y = zona.y * TILE_PX

  return (
    <pixiContainer x={x} y={y}>
      <pixiGraphics draw={desenharFundoRotulo} />
      <pixiText
        text={`${ICONE_ZONA[zona.tipo]} ${zona.nome}`}
        anchor={0.5}
        style={{
          fontFamily: 'Nunito, sans-serif',
          fontSize: 16,
          fontWeight: '900',
          fill: 0xffffff,
          stroke: { color: 0x000000, width: 3 },
        }}
      />
    </pixiContainer>
  )
}
