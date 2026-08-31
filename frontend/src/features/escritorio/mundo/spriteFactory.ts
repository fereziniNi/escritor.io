import type { Graphics as PixiGraphics } from 'pixi.js'
import { COR_ZONA } from '../icones'
import type { Zona } from '../types'
import { TILE_PX } from './constantes'
import type { ItemMobilia, SegmentoParede } from './tipos'

/**
 * "Fábrica" de desenho procedural do mundo - continua o precedente já estabelecido no projeto
 * (`PixelCharacterSvg` é só `<rect>`s com contorno preto; o piso de madeira do mapa antigo era um
 * `repeating-linear-gradient` puro, sem nenhuma imagem) - agora via `PIXI.Graphics` em vez de
 * SVG/CSS. Nenhum asset de imagem é usado em lugar nenhum do mundo: tudo é forma geométrica
 * simples com contorno, na mesma linguagem "pixel art via primitivas".
 */

/** Piso claro com leve tom azulado (pedido do usuário: "tema mais claro, com fundo um pouco
 * azul... parecendo um escritório de verdade") - troca o piso de tábuas de madeira (tom
 * quente/rústico) por um azulejo/carpete claro, mais perto de um escritório moderno de verdade. */
const COR_PISO_CLARO = 0xeef2f6
const COR_PISO_ESCURO = 0xdfe6ec
const COR_LINHA_PISO = 0x2a3a4a
const ALPHA_LINHA_PISO = 0.08

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
  g.stroke({ width: 1, color: COR_LINHA_PISO, alpha: ALPHA_LINHA_PISO })
}

function hexParaNumero(cor: string): number {
  return Number(cor.replace('#', '0x'))
}

/** Tinge o piso de cada zona com a cor do seu `TipoZona` (Fase 3 - "identidade espacial") -
 * translúcido de propósito (alpha baixo) pra não esconder a grade/xadrez do piso por baixo,
 * desenhado entre `desenharPiso` e `desenharMobilia`/`desenharParedes`. */
export function desenharZonas(g: PixiGraphics, zonas: Zona[]): void {
  g.clear()
  for (const zona of zonas) {
    g.rect(zona.x * TILE_PX, zona.y * TILE_PX, zona.largura * TILE_PX, zona.altura * TILE_PX)
    g.fill({ color: hexParaNumero(COR_ZONA[zona.tipo]), alpha: 0.55 })
  }
}

const ESPESSURA_PAREDE_PX = 6
/** Parede clara e fria (divisória de escritório de verdade) - antes era madeira escura tipo
 * "cabana", que não combinava com o pedido de tema claro/azulado. */
const COR_PAREDE = 0xb7c2cd
const COR_PAREDE_BORDA = 0x8793a1

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

/* ---------- móveis/decoração ---------- */

function desenharMesa(g: PixiGraphics, cx: number, cy: number, rotacao: number): void {
  const girada = rotacao === 90 || rotacao === 270
  const largura = girada ? TILE_PX * 0.55 : TILE_PX * 0.8
  const altura = girada ? TILE_PX * 0.8 : TILE_PX * 0.55
  g.roundRect(cx - largura / 2, cy - altura / 2, largura, altura, 3)
  g.fill({ color: 0x8a5a34 })
  g.stroke({ width: 1.5, color: 0x4a3728 })
  const larguraMonitor = largura * 0.35
  const alturaMonitor = altura * 0.35
  g.roundRect(cx - larguraMonitor / 2, cy - alturaMonitor / 2, larguraMonitor, alturaMonitor, 1)
  g.fill({ color: 0x3c4a5a })
}

function desenharCadeira(g: PixiGraphics, cx: number, cy: number): void {
  g.circle(cx, cy, TILE_PX * 0.22)
  g.fill({ color: 0x5c4a3a })
  g.stroke({ width: 1.2, color: 0x2e2418 })
}

function desenharPlanta(g: PixiGraphics, cx: number, cy: number): void {
  g.roundRect(cx - TILE_PX * 0.16, cy + TILE_PX * 0.05, TILE_PX * 0.32, TILE_PX * 0.2, 2)
  g.fill({ color: 0x8a5a34 })
  g.stroke({ width: 1, color: 0x4a3728 })
  g.circle(cx, cy - TILE_PX * 0.05, TILE_PX * 0.22)
  g.circle(cx - TILE_PX * 0.14, cy, TILE_PX * 0.16)
  g.circle(cx + TILE_PX * 0.14, cy, TILE_PX * 0.16)
  g.fill({ color: 0x4f8f6f })
  g.stroke({ width: 1, color: 0x2e5540 })
}

function desenharEstante(g: PixiGraphics, cx: number, cy: number, rotacao: number): void {
  const girada = rotacao === 90 || rotacao === 270
  const largura = girada ? TILE_PX * 0.3 : TILE_PX * 0.85
  const altura = girada ? TILE_PX * 0.85 : TILE_PX * 0.3
  g.rect(cx - largura / 2, cy - altura / 2, largura, altura)
  g.fill({ color: 0x6b4a2f })
  g.stroke({ width: 1.5, color: 0x3a2a1a })
}

function desenharBalcao(g: PixiGraphics, cx: number, cy: number, rotacao: number): void {
  const girado = rotacao === 90 || rotacao === 270
  const largura = girado ? TILE_PX * 0.4 : TILE_PX * 0.9
  const altura = girado ? TILE_PX * 0.9 : TILE_PX * 0.4
  g.rect(cx - largura / 2, cy - altura / 2, largura, altura)
  g.fill({ color: 0xd9b98a })
  g.stroke({ width: 1.5, color: 0x8a5a34 })
}

function desenharTapete(g: PixiGraphics, cx: number, cy: number): void {
  g.roundRect(cx - TILE_PX * 0.9, cy - TILE_PX * 0.6, TILE_PX * 1.8, TILE_PX * 1.2, 6)
  g.fill({ color: 0xe0a94f, alpha: 0.55 })
}

/** Desenha os móveis/decoração - tapetes primeiro (ficam por baixo dos demais itens), depois o
 * resto na ordem em que aparecem em `dadosMundo.MOBILIA_MUNDO`. */
export function desenharMobilia(g: PixiGraphics, itens: ItemMobilia[]): void {
  g.clear()
  const ordenados = [...itens].sort((a, b) => (a.tipo === 'tapete' ? -1 : 0) - (b.tipo === 'tapete' ? -1 : 0))

  for (const item of ordenados) {
    const cx = item.x * TILE_PX + TILE_PX / 2
    const cy = item.y * TILE_PX + TILE_PX / 2
    const rotacao = item.rotacao ?? 0

    switch (item.tipo) {
      case 'mesa':
        desenharMesa(g, cx, cy, rotacao)
        break
      case 'cadeira':
        desenharCadeira(g, cx, cy)
        break
      case 'planta':
        desenharPlanta(g, cx, cy)
        break
      case 'estante':
        desenharEstante(g, cx, cy, rotacao)
        break
      case 'balcao':
        desenharBalcao(g, cx, cy, rotacao)
        break
      case 'tapete':
        desenharTapete(g, cx, cy)
        break
    }
  }
}
