import type { Graphics as PixiGraphics } from 'pixi.js'
import type { EstiloCabelo, EstiloRoupa, TipoBarba, TipoChapeu, TipoOculos } from '../avatar/aparenciaAvatar'

/**
 * Desenho do avatar em camadas via `PIXI.Graphics` - volta a existir depois de uma passagem por
 * sprites prontos (Kenney). O usuário mandou um print do editor de personagem do próprio Gather
 * como referência e pediu "voltar ao sistema desenhado à mão, bem mais detalhado" - "mais
 * detalhado" aqui significa mais forma e mais tom de sombra, não trocar a técnica (continua 100%
 * `PIXI.Graphics`, sem asset de imagem - "nada de arte roubada/baixada do Gather", regra já
 * estabelecida nesta sessão).
 *
 * Em relação à primeira versão desenhada à mão (`ea212ee`, antes do Kenney): cabeça relativamente
 * maior (proporção "chibi" mais forte), 3 tons em vez de 1 (destaque claro + sombra escura, mesma
 * convenção de `spriteFactory.ts` pras móveis, só que agora dos dois lados), olhos com brilho,
 * mãos e sapatos (antes manga/perna terminavam "no vazio"), cabelo com mais textura (3 mechas no
 * topo em vez de um bloco liso), calça acompanha a cor da roupa em vez de um azul-marinho fixo, e
 * uma camada nova - barba (`desenharBarba`, `TipoBarba` - espelha a sub-aba "Facial Hair" da
 * referência).
 */

const COR_CONTORNO = 0x1c1a28
const COR_DESTAQUE = 0xf2a541
/** Azul-ciano de propósito bem distante do laranja de "sou eu" (`COR_DESTAQUE`) - os dois anéis
 * podem aparecer ao mesmo tempo (sou eu E estou perto de alguém) e precisam ser distinguíveis. */
const COR_PROXIMIDADE = 0x4fc3f2

/** Escurece uma cor por um fator (0-1) misturando com preto - usado só pra calça (acompanha a cor
 * da roupa escolhida, um tom mais escuro, em vez do azul-marinho fixo de antes). O resto do
 * sombreamento usa overlay translúcido (branco/preto por cima), mesma convenção já estabelecida em
 * `spriteFactory.ts` pras móveis - só a calça precisa de uma cor sólida de verdade porque é uma
 * peça própria, não uma camada por cima de outra. */
function escurecer(cor: number, fator: number): number {
  const r = Math.round(((cor >> 16) & 0xff) * (1 - fator))
  const g = Math.round(((cor >> 8) & 0xff) * (1 - fator))
  const b = Math.round((cor & 0xff) * (1 - fator))
  return (r << 16) | (g << 8) | b
}

/** Ponto (topo-centro) em torno do qual cada perna gira - usado tanto aqui (desenho local) quanto
 * em `AvatarPixi.tsx` (posicionamento do `Graphics` da perna dentro do container do avatar). */
export const PIVO_PERNA_ESQUERDA = { x: 9, y: 20 }
export const PIVO_PERNA_DIREITA = { x: 15, y: 20 }

/** Perna + sapato, com o topo em (0,0) local - quem chama posiciona o `Graphics` no pivô
 * correspondente (`PIVO_PERNA_ESQUERDA`/`PIVO_PERNA_DIREITA`) e aplica a rotação. `corCalca` é um
 * tom mais escuro da `corRoupa` escolhida (ver `escurecer`), pra combinar com a roupa em vez de
 * ser sempre a mesma cor fixa. */
export function desenharPerna(g: PixiGraphics, corCalca: number): void {
  g.clear()
  g.roundRect(-2, 0, 4, 6.2, 1.3)
  g.fill({ color: corCalca })
  g.stroke({ width: 1, color: COR_CONTORNO })
  // sapato (novo - antes a perna terminava "no vazio")
  g.ellipse(0, 7, 2.2, 1.5)
  g.fill({ color: COR_CONTORNO })
}

/** Sombra sob o avatar - elipse escura no chão, desenhada num `Graphics` próprio, primeiro filho
 * de `AvatarPixi` (antes das pernas/corpo), pra ficar visualmente "atrás" do personagem mesmo sem
 * ordenação de profundidade de verdade. */
export function desenharSombraAvatar(g: PixiGraphics): void {
  g.clear()
  g.ellipse(12, 27, 8, 3.2)
  g.fill({ color: 0x000000, alpha: 0.22 })
}

/** Camada de pele - cabeça/rosto. Braços/mãos/tronco ficam em {@link desenharRoupa} (não são
 * "corpo", são "o que a roupa cobre ou deixa à mostra"). Cabeça proporcionalmente maior que na
 * primeira versão (chibi mais forte) - olhos redondos com um pontinho de brilho, sombra sutil sob
 * o queixo pra dar volume em vez de ficar chapada. */
export function desenharCorpoBase(g: PixiGraphics, corPele: number): void {
  g.clear()

  g.roundRect(5.5, 0.5, 13, 11, 5)
  g.fill({ color: corPele })
  g.stroke({ width: 1.2, color: COR_CONTORNO })

  // sombra sob o queixo (dá volume à cabeça - luz vem de cima, sombra fica embaixo)
  g.roundRect(8, 9, 8, 2.2, 1.4)
  g.fill({ color: 0x000000, alpha: 0.12 })

  // destaque claro no topo (luz de cima-esquerda, mesma convenção do resto do avatar)
  g.roundRect(6.3, 1, 6, 2, 1.2)
  g.fill({ color: 0xffffff, alpha: 0.28 })

  // bochecha
  g.circle(9.6, 7.6, 1.2)
  g.fill({ color: 0xffffff, alpha: 0.22 })

  // olhos - redondos com brilho (antes eram só retângulos lisos)
  g.circle(9.6, 6.8, 1.15)
  g.circle(14.4, 6.8, 1.15)
  g.fill({ color: COR_CONTORNO })
  g.circle(9.9, 6.4, 0.42)
  g.circle(14.7, 6.4, 0.42)
  g.fill({ color: 0xffffff })
}

/** Barba/bigode - nova (Base → Barba, espelha a sub-aba "Facial Hair" da referência do Gather).
 * Usa `corCabelo` (sem paleta própria) - desenhada por cima da pele, antes do cabelo. */
export function desenharBarba(g: PixiGraphics, tipo: TipoBarba, corCabelo: number): void {
  g.clear()
  if (tipo === 'NENHUM') {
    return
  }

  if (tipo === 'BIGODE') {
    g.roundRect(10.3, 8.1, 3.4, 0.9, 0.45)
    g.fill({ color: corCabelo })
    g.stroke({ width: 0.6, color: COR_CONTORNO })
    return
  }

  if (tipo === 'CAVANHAQUE') {
    g.roundRect(10.6, 9.4, 2.8, 2, 1)
    g.fill({ color: corCabelo })
    g.stroke({ width: 0.8, color: COR_CONTORNO })
    return
  }

  // BARBA_CHEIA - contorno ao longo da mandíbula
  g.roundRect(6.3, 8, 11.4, 3.6, 3)
  g.fill({ color: corCabelo })
  g.stroke({ width: 1, color: COR_CONTORNO })
  g.roundRect(7, 8.4, 4, 1.1, 0.7)
  g.fill({ color: 0xffffff, alpha: 0.15 })
}

/** Torso + mangas + mãos, com 4 silhuetas diferentes (regata expõe mais braço, moletom ganha um
 * "bojo" de capuz atrás do pescoço, jaqueta ganha zíper/gola) - todas na mesma cor escolhida
 * (`corRoupa`). `corPele` é só pras mãos (novas - antes a manga terminava "no vazio"). */
export function desenharRoupa(g: PixiGraphics, estilo: EstiloRoupa, corRoupa: number, corPele: number): void {
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

  // mãos (novas - antes a manga terminava "no vazio")
  g.circle(1.5 + larguraManga / 2, 12 + alturaManga + 0.7, 1.2)
  g.circle(22.5 - larguraManga / 2, 12 + alturaManga + 0.7, 1.2)
  g.fill({ color: corPele })
  g.stroke({ width: 0.8, color: COR_CONTORNO })

  // tronco
  g.roundRect(4.5, 11, 15, 10, 4)
  g.fill({ color: corRoupa })
  g.stroke({ width: 1.2, color: COR_CONTORNO })

  // destaque claro (luz de cima-esquerda)
  g.roundRect(6.5, 12.5, 8, 3.5, 2)
  g.fill({ color: 0xffffff, alpha: 0.18 })

  // sombra na base do tronco (nova - dá profundidade, mesma lógica "luz de cima, sombra embaixo")
  g.roundRect(6, 18, 12, 2.4, 2)
  g.fill({ color: 0x000000, alpha: 0.13 })

  if (estilo === 'JAQUETA') {
    g.roundRect(9, 10.6, 6, 2, 1)
    g.fill({ color: 0xffffff, alpha: 0.22 })
    g.moveTo(12, 11.4)
    g.lineTo(12, 20.2)
    g.stroke({ width: 1, color: COR_CONTORNO, alpha: 0.55 })
  }
}

/** 4 estilos de cabelo, cada um construído em cima do anterior (careca não desenha nada, curto é
 * a base, médio/longo acrescentam mais forma). O topo ganha 3 mechas sobrepostas em vez de um
 * bloco liso só (leve efeito "espetado", mais textura). */
export function desenharCabelo(g: PixiGraphics, estilo: EstiloCabelo, corCabelo: number): void {
  g.clear()
  if (estilo === 'CARECA') {
    return
  }

  g.roundRect(5.2, -0.3, 13.6, 4.6, 2.6)
  g.fill({ color: corCabelo })
  g.stroke({ width: 1, color: COR_CONTORNO })

  g.roundRect(6.5, -1.1, 2.6, 2.2, 1.1)
  g.roundRect(10.7, -1.4, 2.6, 2.4, 1.1)
  g.roundRect(14.9, -1.1, 2.6, 2.2, 1.1)
  g.fill({ color: corCabelo })
  g.stroke({ width: 0.8, color: COR_CONTORNO })

  g.roundRect(6.6, 0.1, 6, 1.6, 1)
  g.fill({ color: 0xffffff, alpha: 0.14 })

  if (estilo === 'MEDIO' || estilo === 'LONGO') {
    g.roundRect(4.7, 2, 2.7, 5.8, 1.35)
    g.roundRect(16.6, 2, 2.7, 5.8, 1.35)
    g.fill({ color: corCabelo })
    g.stroke({ width: 1, color: COR_CONTORNO })
  }

  if (estilo === 'LONGO') {
    g.roundRect(4.7, 7.4, 2.5, 7.2, 1.25)
    g.roundRect(16.8, 7.4, 2.5, 7.2, 1.25)
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
    g.circle(9.6, 6.8, 1.7)
    g.circle(14.4, 6.8, 1.7)
    g.stroke({ width: 1, color: COR_CONTORNO })
  } else {
    g.roundRect(8.1, 5.5, 3, 2.8, 0.6)
    g.roundRect(12.9, 5.5, 3, 2.8, 0.6)
    g.stroke({ width: 1, color: COR_CONTORNO })
  }
  g.moveTo(11.2, 6.7)
  g.lineTo(12.8, 6.7)
  g.stroke({ width: 1, color: COR_CONTORNO })
}

export function desenharChapeu(g: PixiGraphics, tipo: TipoChapeu): void {
  g.clear()
  if (tipo === 'NENHUM') {
    return
  }
  if (tipo === 'BONE') {
    g.roundRect(5.3, -1.1, 13.4, 4.5, 3)
    g.fill({ color: 0x2b6cb0 })
    g.stroke({ width: 1, color: COR_CONTORNO })
    g.roundRect(3.1, 1.4, 5.4, 1.6, 1)
    g.fill({ color: 0x2b6cb0 })
    g.stroke({ width: 1, color: COR_CONTORNO })
    g.roundRect(6, -0.8, 5, 1.4, 0.8)
    g.fill({ color: 0xffffff, alpha: 0.2 })
  } else {
    g.roundRect(5, -1.6, 14, 6.2, 4)
    g.fill({ color: 0xc0392b })
    g.stroke({ width: 1, color: COR_CONTORNO })
    g.circle(12, -2.2, 1.4)
    g.fill({ color: 0xffffff })
    g.stroke({ width: 1, color: COR_CONTORNO })
    g.roundRect(5.6, -1.3, 5, 1.6, 0.9)
    g.fill({ color: 0xffffff, alpha: 0.16 })
  }
}

/** Pontinho colorido num canto fixo do avatar - o sinal de status (a cor da roupa não pode mais
 * carregar dois significados desde que virou escolha livre da pessoa). Mesma paleta de sempre
 * (`COR_STATUS`), só um lugar novo pra aparecer. */
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

/** Calça acompanha a cor da roupa escolhida (um tom mais escuro, ver {@link escurecer}) em vez de
 * ser sempre a mesma cor fixa - chamado por `AvatarPixi.tsx` antes de montar o `draw` das pernas. */
export function corCalcaParaRoupa(corRoupa: number): number {
  return escurecer(corRoupa, 0.35)
}
