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
/** Azul-ciano de propósito bem distante do laranja de "sou eu" (`COR_DESTAQUE`) - os dois anéis
 * podem aparecer ao mesmo tempo (sou eu E estou perto de alguém) e precisam ser distinguíveis. */
const COR_PROXIMIDADE = 0x4fc3f2

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

/** Sombra sob o avatar (Fase 6, pedido "tudo muito chapado/sem sombra") - elipse escura no chão,
 * desenhada num `Graphics` próprio, primeiro filho de `AvatarPixi` (antes das pernas/corpo), pra
 * ficar visualmente "atrás" do personagem mesmo sem ordenação de profundidade de verdade. */
export function desenharSombraAvatar(g: PixiGraphics): void {
  g.clear()
  g.ellipse(12, 27, 8, 3.2)
  g.fill({ color: 0x000000, alpha: 0.22 })
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
  // destaque claro (2º tom) no peito - mesmo princípio de sombreamento em 2 tons usado nos móveis
  // (`spriteFactory.ts`), pra o avatar não ficar mais "chapado" que o resto do mundo.
  g.roundRect(6.5, 12.5, 8, 3.5, 2)
  g.fill({ color: 0xffffff, alpha: 0.18 })

  // cabeça
  g.roundRect(6.5, 1.5, 11, 10, 4)
  g.fill({ color: COR_PELE })
  g.stroke({ width: 1.2, color: COR_CONTORNO })
  // bochecha/destaque sutil
  g.circle(9.5, 7.2, 1.1)
  g.fill({ color: 0xffffff, alpha: 0.25 })

  // cabelo
  g.roundRect(5.8, 0.5, 12.4, 4.2, 2.4)
  g.fill({ color: COR_CABELO })
  g.stroke({ width: 1, color: COR_CONTORNO })
  g.roundRect(6.6, 0.8, 5.5, 1.6, 1)
  g.fill({ color: 0xffffff, alpha: 0.12 })

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

/** Anel maior que o de destaque (fica por fora dele quando os dois aparecem juntos) - a
 * pulsação (alpha) é controlada por quem desenha via a prop `alpha` do `<pixiGraphics>`, não aqui. */
export function desenharAnelProximidade(g: PixiGraphics): void {
  g.clear()
  g.circle(12, 16, 20)
  g.stroke({ width: 2.5, color: COR_PROXIMIDADE })
}
