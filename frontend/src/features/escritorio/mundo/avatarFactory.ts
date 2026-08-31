import type { Graphics as PixiGraphics } from 'pixi.js'

/**
 * Porta as proporções exatas de `PixelCharacterSvg.tsx` (viewBox 0 0 24 30) pra `PIXI.Graphics` -
 * mesmos números, mesma paleta, só o motor de desenho muda de SVG pra canvas. As pernas ficam em
 * `Graphics` separados das demais partes porque cada uma precisa de rotação própria em torno do
 * seu topo pro balanço de andar (Fase 2.2) - o resto do corpo (tronco/braços/cabeça/cabelo/olhos)
 * não anima, então fica num só `Graphics` estático.
 */

const COR_CONTORNO = 0x1c1a28
const COR_PERNA = 0x3a3550
const COR_PELE = 0xf2c9a0
const COR_CABELO = 0x4a3728
const COR_DESTAQUE = 0xf2a541

/** Ponto (topo-centro) em torno do qual cada perna gira - usado tanto aqui (desenho local) quanto
 * em `AvatarPixi.tsx` (posicionamento do `Graphics` da perna dentro do container do avatar). */
export const PIVO_PERNA_ESQUERDA = { x: 9, y: 20 }
export const PIVO_PERNA_DIREITA = { x: 15, y: 20 }

/** Desenha uma perna com o topo em (0,0) local - quem chama posiciona o `Graphics` no pivô
 * correspondente (`PIVO_PERNA_ESQUERDA`/`PIVO_PERNA_DIREITA`) e aplica a rotação. */
export function desenharPerna(g: PixiGraphics): void {
  g.clear()
  g.roundRect(-2, 0, 4, 7, 1.3)
  g.fill({ color: COR_PERNA })
  g.stroke({ width: 1, color: COR_CONTORNO })
}

export function desenharCorpoAvatar(g: PixiGraphics, corCorpo: number): void {
  g.clear()

  // braços
  g.roundRect(1.5, 12, 3.4, 7.5, 1.6)
  g.roundRect(19, 12, 3.4, 7.5, 1.6)
  g.fill({ color: corCorpo })
  g.stroke({ width: 1, color: COR_CONTORNO })

  // tronco
  g.roundRect(4.5, 11, 15, 10, 4)
  g.fill({ color: corCorpo })
  g.stroke({ width: 1.2, color: COR_CONTORNO })

  // cabeça
  g.roundRect(6.5, 1.5, 11, 10, 4)
  g.fill({ color: COR_PELE })
  g.stroke({ width: 1.2, color: COR_CONTORNO })

  // cabelo
  g.roundRect(5.8, 0.5, 12.4, 4.2, 2.4)
  g.fill({ color: COR_CABELO })
  g.stroke({ width: 1, color: COR_CONTORNO })

  // olhos
  g.roundRect(9.2, 6.6, 1.6, 1.8, 0.4)
  g.roundRect(13.2, 6.6, 1.6, 1.8, 0.4)
  g.fill({ color: COR_CONTORNO })
}

export function desenharAnelDestaque(g: PixiGraphics): void {
  g.clear()
  g.circle(12, 16, 15)
  g.stroke({ width: 2, color: COR_DESTAQUE, alpha: 0.9 })
}
