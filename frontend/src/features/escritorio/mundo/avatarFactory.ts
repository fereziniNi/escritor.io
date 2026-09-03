import type { Graphics as PixiGraphics } from 'pixi.js'
import type { EstiloCabelo, EstiloRoupa, TipoChapeu, TipoOculos } from '../avatar/aparenciaAvatar'

/**
 * Porta as proporções exatas de `PixelCharacterSvg.tsx` (viewBox 0 0 24 30) pra `PIXI.Graphics` -
 * mesmos números, mesma paleta-base, só o motor de desenho muda de SVG pra canvas. As pernas
 * ficam em `Graphics` separados das demais partes porque cada uma precisa de rotação própria em
 * torno do seu topo pro balanço de andar (Fase 2.2).
 *
 * Fase de personalização de avatar (pedido do usuário: "o personagem fosse mais detalhado... a
 * opção para todos detalhar da melhor maneira possível o avatar"): o antigo `desenharCorpoAvatar`
 * monolítico (uma cor só, sempre a mesma pele/cabelo/roupa) virou 5 camadas independentes -
 * `desenharCorpoBase` (pele/olhos), `desenharRoupa` (torso/mangas, com 4 silhuetas), `desenharCabelo`
 * (4 estilos), `desenharOculos`/`desenharChapeu` (acessórios, opcionais). `AvatarPixi.tsx` compõe
 * as 5 na ordem roupa→corpo→cabelo→óculos→chapéu (mesma ordem "de trás pra frente" que o desenho
 * único antigo já respeitava: braços/tronco embaixo, cabeça por cima, cabelo por cima da cabeça).
 */

const COR_CONTORNO = 0x1c1a28
const COR_PERNA = 0x3a3550
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

/** Camada de pele - cabeça/olhos/bochecha. Braços/tronco viraram parte de {@link desenharRoupa}
 * (não são mais "corpo", são "o que a roupa cobre"), então esta função não desenha mais braço
 * nenhum. */
export function desenharCorpoBase(g: PixiGraphics, corPele: number): void {
  g.clear()

  g.roundRect(6.5, 1.5, 11, 10, 4)
  g.fill({ color: corPele })
  g.stroke({ width: 1.2, color: COR_CONTORNO })
  // bochecha/destaque sutil
  g.circle(9.5, 7.2, 1.1)
  g.fill({ color: 0xffffff, alpha: 0.25 })

  // olhos
  g.roundRect(9.2, 6.6, 1.6, 1.8, 0.4)
  g.roundRect(13.2, 6.6, 1.6, 1.8, 0.4)
  g.fill({ color: COR_CONTORNO })
}

/** Torso + mangas, com 4 silhuetas diferentes (regata expõe mais braço, moletom ganha um "bojo"
 * de capuz atrás do pescoço, jaqueta ganha zíper/gola) - todas na mesma cor escolhida
 * (`corRoupa`), sem precisar de um `Graphics` por peça de roupa. */
export function desenharRoupa(g: PixiGraphics, estilo: EstiloRoupa, corRoupa: number): void {
  g.clear()

  const mangaCurta = estilo === 'REGATA'
  const larguraManga = mangaCurta ? 2.1 : 3.4
  const alturaManga = mangaCurta ? 4.2 : 7.5

  // capuz do moletom - desenhado ANTES do tronco pra ficar atrás do pescoço/cabeça
  if (estilo === 'MOLETOM') {
    g.roundRect(7, 9.3, 10, 3.2, 2)
    g.fill({ color: corRoupa })
    g.stroke({ width: 1, color: COR_CONTORNO })
  }

  // mangas
  g.roundRect(1.5, 12, larguraManga, alturaManga, 1.6)
  g.roundRect(22.5 - larguraManga, 12, larguraManga, alturaManga, 1.6)
  g.fill({ color: corRoupa })
  g.stroke({ width: 1, color: COR_CONTORNO })

  // tronco
  g.roundRect(4.5, 11, 15, 10, 4)
  g.fill({ color: corRoupa })
  g.stroke({ width: 1.2, color: COR_CONTORNO })
  // destaque claro (2º tom) no peito - mesmo princípio de sombreamento em 2 tons usado nos móveis
  // (`spriteFactory.ts`), pra o avatar não ficar mais "chapado" que o resto do mundo.
  g.roundRect(6.5, 12.5, 8, 3.5, 2)
  g.fill({ color: 0xffffff, alpha: 0.18 })

  if (estilo === 'JAQUETA') {
    g.roundRect(9, 10.6, 6, 2, 1)
    g.fill({ color: 0xffffff, alpha: 0.22 })
    g.moveTo(12, 11.4)
    g.lineTo(12, 20.2)
    g.stroke({ width: 1, color: COR_CONTORNO, alpha: 0.55 })
  }
}

/** 4 estilos de cabelo, cada um construído em cima do anterior (careca não desenha nada, curto é
 * a base, médio/longo acrescentam mais forma) - evita repetir a base 3 vezes. */
export function desenharCabelo(g: PixiGraphics, estilo: EstiloCabelo, corCabelo: number): void {
  g.clear()
  if (estilo === 'CARECA') {
    return
  }

  g.roundRect(5.8, 0.5, 12.4, 4.2, 2.4)
  g.fill({ color: corCabelo })
  g.stroke({ width: 1, color: COR_CONTORNO })
  g.roundRect(6.6, 0.8, 5.5, 1.6, 1)
  g.fill({ color: 0xffffff, alpha: 0.12 })

  if (estilo === 'MEDIO' || estilo === 'LONGO') {
    g.roundRect(5.3, 2.3, 2.6, 5.5, 1.3)
    g.roundRect(16.1, 2.3, 2.6, 5.5, 1.3)
    g.fill({ color: corCabelo })
    g.stroke({ width: 1, color: COR_CONTORNO })
  }

  if (estilo === 'LONGO') {
    g.roundRect(5.3, 6.9, 2.4, 6.8, 1.2)
    g.roundRect(16.3, 6.9, 2.4, 6.8, 1.2)
    g.fill({ color: corCabelo })
    g.stroke({ width: 1, color: COR_CONTORNO })
  }
}

/** Cor fixa (não personalizável) de propósito - acessório é uma escolha de forma, não de cor,
 * pra manter a aba "Acessórios" do editor simples (só uma grade de miniaturas, sem grade de cor
 * repetida de novo). */
export function desenharOculos(g: PixiGraphics, tipo: TipoOculos): void {
  g.clear()
  if (tipo === 'NENHUM') {
    return
  }
  if (tipo === 'REDONDO') {
    g.circle(10, 7.4, 1.6)
    g.circle(14, 7.4, 1.6)
    g.stroke({ width: 1, color: COR_CONTORNO })
  } else {
    g.roundRect(8.6, 6, 2.8, 2.6, 0.6)
    g.roundRect(12.6, 6, 2.8, 2.6, 0.6)
    g.stroke({ width: 1, color: COR_CONTORNO })
  }
  g.moveTo(11.6, 7.3)
  g.lineTo(12.4, 7.3)
  g.stroke({ width: 1, color: COR_CONTORNO })
}

export function desenharChapeu(g: PixiGraphics, tipo: TipoChapeu): void {
  g.clear()
  if (tipo === 'NENHUM') {
    return
  }
  if (tipo === 'BONE') {
    g.roundRect(5.5, -0.3, 13, 4.5, 3)
    g.fill({ color: 0x2b6cb0 })
    g.stroke({ width: 1, color: COR_CONTORNO })
    g.roundRect(3.3, 2, 5.2, 1.6, 1)
    g.fill({ color: 0x2b6cb0 })
    g.stroke({ width: 1, color: COR_CONTORNO })
  } else {
    g.roundRect(5.2, -0.8, 13.6, 6, 4)
    g.fill({ color: 0xc0392b })
    g.stroke({ width: 1, color: COR_CONTORNO })
    g.circle(12, -1.4, 1.3)
    g.fill({ color: 0xffffff })
    g.stroke({ width: 1, color: COR_CONTORNO })
  }
}

/** Pontinho colorido num canto fixo do avatar - substitui a cor da roupa como sinal de status
 * (Fase de personalização: a roupa virou escolha da pessoa, não pode mais carregar dois
 * significados ao mesmo tempo). Mesma paleta de sempre (`COR_STATUS`), só um lugar novo pra
 * aparecer. */
export function desenharIndicadorStatus(g: PixiGraphics, corStatus: number): void {
  g.clear()
  g.circle(19.3, 19.3, 2.2)
  g.fill({ color: corStatus })
  g.stroke({ width: 1.2, color: 0xffffff })
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
