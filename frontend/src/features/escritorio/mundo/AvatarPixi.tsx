import { extend } from '@pixi/react'
import { Container, Graphics, Text } from 'pixi.js'
import { useMemo } from 'react'
import { TILE_PX } from './constantes'
import { desenharAnelDestaque, desenharCorpoAvatar, desenharPerna, PIVO_PERNA_DIREITA, PIVO_PERNA_ESQUERDA } from './avatarFactory'

extend({ Container, Graphics, Text })

/** Escala aplicada por cima das coordenadas nativas de `PixelCharacterSvg` (viewBox 24×30) - dá
 * um personagem de ~26×33px, um pouco menor que o tile (32px) na largura, mais alto que o tile na
 * altura (a "cabeça" estica pra cima, mesma proporção "gente de pé vista de cima" do desenho
 * original em SVG). */
const ESCALA_AVATAR = 1.1

/** (x,y) local do ponto que fica ancorado na posição-mundo do avatar: base da caixa 24×30, um
 * pouco acima do fundo das pernas (27) pra "pisar" visualmente no chão em vez de flutuar. */
const PIVO_BASE = { x: 12, y: 27 }

const COR_TEXTO_NOME = 0xffffff

function hexParaNumero(cor: string): number {
  return Number(cor.replace('#', '0x'))
}

export function AvatarPixi({
  tileX,
  tileY,
  nome,
  corCorpo,
  direcao,
  anguloPerna = 0,
  destaque,
}: {
  /** posição em tiles (pode ter fração durante o glide entre tiles, Fase 2.2) */
  tileX: number
  tileY: number
  nome: string
  corCorpo: string
  direcao: 'esquerda' | 'direita'
  /** ângulo de balanço das pernas em radianos - 0 = parado, oscila enquanto anda (Fase 2.2) */
  anguloPerna?: number
  destaque: boolean
}) {
  const corCorpoNumero = useMemo(() => hexParaNumero(corCorpo), [corCorpo])
  const worldX = tileX * TILE_PX + TILE_PX / 2
  const worldY = tileY * TILE_PX + TILE_PX

  return (
    <pixiContainer x={worldX} y={worldY}>
      <pixiContainer pivot={PIVO_BASE} scale={{ x: direcao === 'esquerda' ? -ESCALA_AVATAR : ESCALA_AVATAR, y: ESCALA_AVATAR }}>
        {destaque && <pixiGraphics draw={desenharAnelDestaque} />}
        <pixiGraphics
          draw={desenharPerna}
          x={PIVO_PERNA_ESQUERDA.x}
          y={PIVO_PERNA_ESQUERDA.y}
          rotation={anguloPerna}
        />
        <pixiGraphics
          draw={desenharPerna}
          x={PIVO_PERNA_DIREITA.x}
          y={PIVO_PERNA_DIREITA.y}
          rotation={-anguloPerna}
        />
        <pixiGraphics draw={(g) => desenharCorpoAvatar(g, corCorpoNumero)} />
      </pixiContainer>

      <pixiText
        text={nome}
        anchor={{ x: 0.5, y: 1 }}
        y={-PIVO_BASE.y * ESCALA_AVATAR - 6}
        style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, fontWeight: '800', fill: COR_TEXTO_NOME, stroke: { color: 0x2b2b3a, width: 3 } }}
      />
    </pixiContainer>
  )
}
