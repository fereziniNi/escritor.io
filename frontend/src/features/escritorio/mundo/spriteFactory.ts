import type { Graphics as PixiGraphics } from 'pixi.js'
import { TILE_PX } from './constantes'
import type { SegmentoParede } from './tipos'

/**
 * "Fábrica" de desenho procedural do mundo - continua o precedente já estabelecido no projeto
 * (`PixelCharacterSvg` é só `<rect>`s com contorno preto; o piso de madeira do mapa antigo era um
 * `repeating-linear-gradient` puro, sem nenhuma imagem) - agora via `PIXI.Graphics` em vez de
 * SVG/CSS. Nenhum asset de imagem é usado em lugar nenhum do mundo: tudo é forma geométrica
 * simples com contorno, na mesma linguagem "pixel art via primitivas".
 */

const COR_PISO_CLARO = 0xd9b98a
const COR_PISO_ESCURO = 0xc9a877
const COR_LINHA_PISO = 0x00000014 // preto quase transparente, só pra marcar a grade

/** Desenha o piso do mundo inteiro (tabuleiro xadrez sutil, uma cor a cada 2 tiles, como o piso
 * de tábuas de madeira que existia em CSS) num único `Graphics`, mais barato que um sprite por
 * tile. */
export function desenharPiso(g: PixiGraphics, larguraTiles: number, alturaTiles: number): void {
  g.clear()
  for (let ty = 0; ty < alturaTiles; ty++) {
    for (let tx = 0; tx < larguraTiles; tx++) {
      const par = (tx + ty) % 2 === 0
      g.rect(tx * TILE_PX, ty * TILE_PX, TILE_PX, TILE_PX)
      g.fill({ color: par ? COR_PISO_CLARO : COR_PISO_ESCURO })
    }
  }
  // grade fina por cima, uma linha por tile
  for (let tx = 0; tx <= larguraTiles; tx++) {
    g.moveTo(tx * TILE_PX, 0)
    g.lineTo(tx * TILE_PX, alturaTiles * TILE_PX)
  }
  for (let ty = 0; ty <= alturaTiles; ty++) {
    g.moveTo(0, ty * TILE_PX)
    g.lineTo(larguraTiles * TILE_PX, ty * TILE_PX)
  }
  g.stroke({ width: 1, color: COR_LINHA_PISO })
}

const ESPESSURA_PAREDE_PX = 6
const COR_PAREDE = 0x2b1f16
const COR_PAREDE_BORDA = 0x1a120c

/** Desenha todas as paredes num único `Graphics` - cada segmento vira um retângulo fino sobre a
 * linha de grade correspondente, esticado meia espessura além das pontas nominais pra as quinas
 * entre segmentos perpendiculares fecharem sem buraco visual. */
export function desenharParedes(g: PixiGraphics, paredes: SegmentoParede[]): void {
  g.clear()
  for (const parede of paredes) {
    const meia = ESPESSURA_PAREDE_PX / 2
    if (parede.orientacao === 'horizontal') {
      const largura = parede.comprimento * TILE_PX + ESPESSURA_PAREDE_PX
      g.rect(parede.x * TILE_PX - meia, parede.y * TILE_PX - meia, largura, ESPESSURA_PAREDE_PX)
    } else {
      const altura = parede.comprimento * TILE_PX + ESPESSURA_PAREDE_PX
      g.rect(parede.x * TILE_PX - meia, parede.y * TILE_PX - meia, ESPESSURA_PAREDE_PX, altura)
    }
    g.fill({ color: COR_PAREDE })
    g.stroke({ width: 1, color: COR_PAREDE_BORDA })
  }
}
