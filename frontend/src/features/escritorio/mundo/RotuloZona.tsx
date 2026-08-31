import type { Graphics as PixiGraphics } from 'pixi.js'
import { ICONE_ZONA } from '../icones'
import type { Zona } from '../types'
import { TILE_PX } from './constantes'

const LARGURA_ROTULO = 168
const ALTURA_ROTULO = 24
const COR_FUNDO = 0x2b2b3a
const ALPHA_FUNDO = 0.82

function desenharFundoRotulo(g: PixiGraphics): void {
  g.clear()
  g.roundRect(-LARGURA_ROTULO / 2, -ALTURA_ROTULO / 2, LARGURA_ROTULO, ALTURA_ROTULO, 12)
  g.fill({ color: COR_FUNDO, alpha: ALPHA_FUNDO })
}

/**
 * Identificação de sala flutuando sobre o mapa (pedido do usuário: "uma identificação de cada
 * lugar do mapa") - pílula escura com ícone+nome, no mesmo espírito das etiquetas de nome de sala
 * do Gather.town. Sem colisão/física, é só um `pixiContainer` centralizado no topo da zona.
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
        style={{ fontFamily: 'Nunito, sans-serif', fontSize: 12, fontWeight: '800', fill: 0xffffff }}
      />
    </pixiContainer>
  )
}
