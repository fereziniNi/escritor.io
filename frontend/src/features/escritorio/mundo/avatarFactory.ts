import type { Graphics as PixiGraphics } from 'pixi.js'
import type {
  EstiloBottom,
  EstiloCabelo,
  EstiloJaqueta,
  EstiloOutro,
  EstiloSapato,
  EstiloTop,
  TipoBarba,
  TipoChapeu,
  TipoOculos,
} from '../avatar/aparenciaAvatar'

/**
 * Desenho do avatar em camadas via `PIXI.Graphics` - 10 categorias (Skin/Hair/Facial hair/Top/
 * Jacket/Bottom/Shoes/Hat/Glasses/Other), mesma estrutura/quantidade de opções de sempre (usuário
 * pediu pra manter "esse leque de opções"). O que muda aqui é só o design: a versão anterior
 * desenhava a cabeça como um retângulo arredondado (lia como "capacete quadrado", não como rosto)
 * e o cabelo como uma faixa sólida sem forma de cabelo de verdade - usuário: "o design do boneco
 * atual está extremamente ruim".
 *
 * Corpo novo, mesma técnica (100% `PIXI.Graphics`, sem asset de imagem): cabeça é um CÍRCULO de
 * verdade (não mais `roundRect`), cabelo é uma "touca" (elipse mais larga que a cabeça, cobrindo só
 * a metade de cima - a técnica padrão de personagem chibi em camadas, já que não dá pra recortar/
 * subtrair formas no Graphics), pescoço visível conectando cabeça ao torso, torso com cantos bem
 * mais arredondados (ombros lidos como curva, não quina), mangas em cápsula (pontas redondas) em
 * vez de retângulo reto.
 *
 * Ordem de camada (de trás pra frente, ver `AvatarPixi.tsx`): sombra → pernas (bottom + sapato,
 * uma peça só por perna) → top → jaqueta → corpo (pele/rosto) → barba → cabelo → chapéu → óculos
 * → outro (acessório de peito/pescoço) → indicador de status → anéis.
 */

const COR_CONTORNO = 0x1c1a28
const COR_DESTAQUE = 0xf2a541
/** Azul-ciano de propósito bem distante do laranja de "sou eu" (`COR_DESTAQUE`) - os dois anéis
 * podem aparecer ao mesmo tempo (sou eu E estou perto de alguém) e precisam ser distinguíveis. */
const COR_PROXIMIDADE = 0x4fc3f2

/** Geometria da cabeça - um círculo de verdade (não mais `roundRect`), é o que mais diferencia um
 * rosto chibi de um "capacete quadrado". Cabelo/barba/chapéu/óculos são todos posicionados a
 * partir destas 3 constantes, pra tudo continuar alinhado se a cabeça mudar de novo no futuro. */
const CABECA_CX = 12
const CABECA_CY = 6.4
const CABECA_R = 6

function escurecer(cor: number, fator: number): number {
  const r = Math.round(((cor >> 16) & 0xff) * (1 - fator))
  const g = Math.round(((cor >> 8) & 0xff) * (1 - fator))
  const b = Math.round((cor & 0xff) * (1 - fator))
  return (r << 16) | (g << 8) | b
}

function clarear(cor: number, fator: number): number {
  const r = Math.round(((cor >> 16) & 0xff) + (255 - ((cor >> 16) & 0xff)) * fator)
  const g = Math.round(((cor >> 8) & 0xff) + (255 - ((cor >> 8) & 0xff)) * fator)
  const b = Math.round((cor & 0xff) + (255 - (cor & 0xff)) * fator)
  return (r << 16) | (g << 8) | b
}

/* ==================== pernas (bottom + sapato) ==================== */

export const PIVO_PERNA_ESQUERDA = { x: 9, y: 20 }
export const PIVO_PERNA_DIREITA = { x: 15, y: 20 }

/** Peça de baixo (cintura até tornozelo) - saia/saia longa ficam um pouco fora do normal nesse
 * rig (2 pernas independentes que balançam ao andar, sem um "sino" só cobrindo as duas), mas dá
 * pra sugerir a silhueta com um leve alargamento pra baixo em cada perna. */
function desenharBottom(g: PixiGraphics, estilo: EstiloBottom, cor: number): void {
  const escuro = escurecer(cor, 0.22)
  switch (estilo) {
    case 'SHORT':
      g.roundRect(-2, 0, 4, 2.6, 1.3)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      break
    case 'BERMUDA':
      g.roundRect(-2, 0, 4, 4.2, 1.4)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      break
    case 'SHORT_JEANS':
      g.roundRect(-2, 0, 4, 2.6, 1.3)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      g.rect(-2, 1.6, 4, 0.4)
      g.fill({ color: escuro })
      break
    case 'SAIA':
      g.moveTo(-1.3, 0)
      g.lineTo(1.3, 0)
      g.lineTo(2.6, 4.2)
      g.lineTo(-2.6, 4.2)
      g.closePath()
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      break
    case 'SAIA_LONGA':
      g.moveTo(-1.3, 0)
      g.lineTo(1.3, 0)
      g.lineTo(2.9, 6.2)
      g.lineTo(-2.9, 6.2)
      g.closePath()
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      break
    case 'LEGGING':
      g.roundRect(-1.5, 0, 3, 6.2, 1.4)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      break
    case 'JEANS':
      g.roundRect(-2, 0, 4, 6.2, 1.6)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      g.moveTo(-0.6, 0.5)
      g.lineTo(-0.6, 5.7)
      g.stroke({ width: 0.5, color: escuro })
      break
    case 'CALCA_LISTRADA':
      g.roundRect(-2, 0, 4, 6.2, 1.6)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      for (let y = 1; y < 6; y += 1.4) {
        g.rect(-2, y, 4, 0.4)
        g.fill({ color: escuro, alpha: 0.7 })
      }
      break
    case 'CALCA':
    default:
      g.roundRect(-2, 0, 4, 6.2, 1.6)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
  }
}

function desenharSapato(g: PixiGraphics, estilo: EstiloSapato, cor: number): void {
  const sola = 0x2b2b3a
  switch (estilo) {
    case 'DESCALCO':
      return
    case 'TENIS':
      g.ellipse(0, 6.6, 2.3, 1.3)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      g.roundRect(-2.1, 7.3, 4.2, 0.9, 0.4)
      g.fill({ color: 0xffffff })
      g.stroke({ width: 0.6, color: COR_CONTORNO })
      break
    case 'SOCIAL':
      g.ellipse(0, 6.8, 2.1, 1.2)
      g.fill({ color: sola })
      g.stroke({ width: 1, color: COR_CONTORNO })
      break
    case 'BOTA':
      g.roundRect(-2, 4.4, 4, 3.2, 1.4)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      break
    case 'BOTA_CANO_ALTO':
      g.roundRect(-2, 2.2, 4, 5.4, 1.4)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      break
    case 'SANDALIA':
      g.ellipse(0, 6.8, 2.2, 1.3)
      g.fill({ color: clarear(cor, 0.35) })
      g.stroke({ width: 1, color: COR_CONTORNO })
      g.moveTo(-1.8, 6.1)
      g.lineTo(1.8, 6.1)
      g.stroke({ width: 0.8, color: cor })
      break
    case 'CHINELO':
      g.ellipse(0, 7, 2.3, 1.1)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      g.moveTo(0, 5.8)
      g.lineTo(-1, 6.6)
      g.moveTo(0, 5.8)
      g.lineTo(1, 6.6)
      g.stroke({ width: 0.8, color: COR_CONTORNO })
      break
    case 'SALTO':
      g.moveTo(-2, 6.1)
      g.lineTo(2, 6.1)
      g.lineTo(1.2, 7.6)
      g.lineTo(-1.6, 7)
      g.closePath()
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      g.rect(0.5, 7.4, 0.6, 1.6)
      g.fill({ color: sola })
      break
  }
}

/** Perna inteira (topo em (0,0) local, quem chama posiciona no pivô e aplica rotação) - bottom +
 * sapato numa peça só, pra continuar o balanço de andar existente sem precisar de 4 `Graphics`
 * por perna. */
export function desenharPerna(g: PixiGraphics, estiloBottom: EstiloBottom, corBottom: number, estiloSapato: EstiloSapato, corSapato: number): void {
  g.clear()
  desenharBottom(g, estiloBottom, corBottom)
  desenharSapato(g, estiloSapato, corSapato)
}

/* ==================== sombra ==================== */

export function desenharSombraAvatar(g: PixiGraphics): void {
  g.clear()
  g.ellipse(12, 27, 8, 3.2)
  g.fill({ color: 0x000000, alpha: 0.22 })
}

/* ==================== top (camisa/camiseta - por baixo da jaqueta) ==================== */

/** Torso com cantos bem mais arredondados que antes (raio grande em relação à largura) - lê como
 * ombro curvo em vez de quina reta, mesmo sem poder desenhar um trapézio de verdade. */
function torsoBase(g: PixiGraphics, cor: number): void {
  g.roundRect(5.5, 13, 13, 8.5, 4.5)
  g.fill({ color: cor })
  g.stroke({ width: 1.2, color: COR_CONTORNO })
  g.roundRect(7, 14, 7, 3, 2)
  g.fill({ color: 0xffffff, alpha: 0.18 })
  g.roundRect(6.5, 19, 11, 2.2, 2)
  g.fill({ color: 0x000000, alpha: 0.13 })
}

/** Manga em cápsula (raio = metade da largura) - ponta redonda em vez de retângulo reto, lê como
 * braço/manga de verdade em vez de uma tábua. */
function manga(g: PixiGraphics, esquerda: boolean, largura: number, altura: number, cor: number): void {
  const x = esquerda ? 2.2 : 21.8 - largura
  g.roundRect(x, 13.6, largura, altura, largura / 2)
  g.fill({ color: cor })
  g.stroke({ width: 1, color: COR_CONTORNO })
}

function maos(g: PixiGraphics, esquerda: boolean, largura: number, altura: number, corPele: number): void {
  const cx = esquerda ? 2.2 + largura / 2 : 21.8 - largura / 2
  g.circle(cx, 13.6 + altura + 0.6, 1.15)
  g.fill({ color: corPele })
  g.stroke({ width: 0.8, color: COR_CONTORNO })
}

function golaV(g: PixiGraphics, cor: number): void {
  g.moveTo(9.5, 13)
  g.lineTo(12, 16.5)
  g.lineTo(14.5, 13)
  g.stroke({ width: 1, color: escurecer(cor, 0.3) })
}

function golaAlta(g: PixiGraphics, cor: number): void {
  g.roundRect(8.7, 11.5, 6.6, 2.4, 1.3)
  g.fill({ color: cor })
  g.stroke({ width: 1, color: COR_CONTORNO })
}

function texturaListrada(g: PixiGraphics, cor: number): void {
  const escuro = escurecer(cor, 0.25)
  for (let y = 14.6; y < 21; y += 1.9) {
    g.rect(5.5, y, 13, 0.6)
    g.fill({ color: escuro, alpha: 0.55 })
  }
}

export function desenharTop(g: PixiGraphics, estilo: EstiloTop, corTop: number, corPele: number): void {
  g.clear()

  const mangaCurta = estilo === 'REGATA'
  const largura = mangaCurta ? 2 : 3.2
  const altura = mangaCurta ? 4.2 : 7.4

  if (estilo === 'MOLETOM_LEVE') {
    g.roundRect(7.3, 11.2, 9.4, 3.2, 2)
    g.fill({ color: corTop })
    g.stroke({ width: 1, color: COR_CONTORNO })
  }

  manga(g, true, largura, altura, corTop)
  manga(g, false, largura, altura, corTop)
  maos(g, true, largura, altura, corPele)
  maos(g, false, largura, altura, corPele)
  torsoBase(g, corTop)

  switch (estilo) {
    case 'POLO':
      g.moveTo(9.8, 13)
      g.lineTo(11.4, 15)
      g.lineTo(9.8, 15)
      g.moveTo(14.2, 13)
      g.lineTo(12.6, 15)
      g.lineTo(14.2, 15)
      g.fill({ color: 0xffffff, alpha: 0.5 })
      g.circle(12, 16.3, 0.35)
      g.circle(12, 17.7, 0.35)
      g.fill({ color: escurecer(corTop, 0.35) })
      break
    case 'CAMISA':
      g.moveTo(9.5, 13)
      g.lineTo(12, 16)
      g.lineTo(14.5, 13)
      g.stroke({ width: 1, color: escurecer(corTop, 0.3) })
      g.moveTo(12, 16)
      g.lineTo(12, 21)
      g.stroke({ width: 0.6, color: escurecer(corTop, 0.3), alpha: 0.6 })
      break
    case 'SUETER':
      golaAlta(g, corTop)
      break
    case 'LISTRADA':
      texturaListrada(g, corTop)
      break
    case 'GOLA_V':
      golaV(g, corTop)
      break
    case 'GOLA_ALTA':
      golaAlta(g, corTop)
      break
  }
}

/* ==================== jaqueta (camada opcional por cima do top) ==================== */

export function desenharJaqueta(g: PixiGraphics, estilo: EstiloJaqueta, cor: number): void {
  g.clear()
  if (estilo === 'NENHUMA') {
    return
  }

  const alturaFlap = estilo === 'CASACO_LONGO' ? 13.6 : estilo === 'COLETE' ? 9 : 10.6
  const semManga = estilo === 'COLETE'

  if (estilo === 'MOLETOM_CAPUZ') {
    g.roundRect(6.8, 10.7, 10.4, 3.6, 2)
    g.fill({ color: cor })
    g.stroke({ width: 1, color: COR_CONTORNO })
    g.circle(9.2, 12.4, 0.35)
    g.circle(14.8, 12.4, 0.35)
    g.fill({ color: escurecer(cor, 0.3) })
  }

  if (!semManga) {
    manga(g, true, 3.4, 7.5, cor)
    manga(g, false, 3.4, 7.5, cor)
  }

  g.roundRect(4, 12.6, 6.2, alturaFlap, 3)
  g.roundRect(13.8, 12.6, 6.2, alturaFlap, 3)
  g.fill({ color: cor })
  g.stroke({ width: 1.2, color: COR_CONTORNO })
  g.roundRect(4.6, 13.2, 2.8, 2.6, 1.4)
  g.fill({ color: 0xffffff, alpha: 0.16 })

  switch (estilo) {
    case 'BLAZER':
      g.moveTo(9.8, 12.6)
      g.lineTo(8, 15.5)
      g.moveTo(14.2, 12.6)
      g.lineTo(16, 15.5)
      g.stroke({ width: 1, color: escurecer(cor, 0.35) })
      break
    case 'BOMBER':
      g.roundRect(2, 20.5, 3.2, 1.4, 0.8)
      g.roundRect(18.8, 20.5, 3.2, 1.4, 0.8)
      g.roundRect(6, 12.6, 12, 1.6, 1)
      g.fill({ color: escurecer(cor, 0.35) })
      break
    case 'CARDIGA':
      for (let y = 14; y < 21; y += 2.4) {
        g.circle(12, y, 0.4)
      }
      g.fill({ color: escurecer(cor, 0.4) })
      break
    case 'COURO':
      g.moveTo(5.5, 14)
      g.lineTo(9, 21)
      g.stroke({ width: 1.2, color: clarear(cor, 0.3), alpha: 0.5 })
      break
    case 'JEANS':
      g.rect(5.5, 16, 2.8, 2.8)
      g.rect(15.7, 16, 2.8, 2.8)
      g.stroke({ width: 0.8, color: escurecer(cor, 0.3) })
      break
    case 'CASACO_LONGO':
      g.roundRect(6.5, 21.5, 11, 2.2, 1.5)
      g.fill({ color: 0x000000, alpha: 0.12 })
      break
  }
}

/* ==================== corpo (pele/rosto) ==================== */

/** Cabeça (círculo), pescoço e rosto - a mudança de maior impacto do redesign: antes era um
 * `roundRect` (lia como capacete quadrado), agora é um círculo de verdade + um pescoço visível
 * conectando à roupa, em vez da cabeça "flutuar" colada direto no tronco. */
export function desenharCorpoBase(g: PixiGraphics, corPele: number): void {
  g.clear()

  // pescoço - conecta a base da cabeça (~12.4) ao topo do torso (~13)
  g.roundRect(9.8, 11.4, 4.4, 2.6, 1.3)
  g.fill({ color: corPele })
  g.stroke({ width: 1, color: COR_CONTORNO })

  // cabeça
  g.circle(CABECA_CX, CABECA_CY, CABECA_R)
  g.fill({ color: corPele })
  g.stroke({ width: 1.2, color: COR_CONTORNO })

  // sombra de forma (luz de cima-esquerda, sombra no quadrante inferior-direito do rosto)
  g.circle(CABECA_CX + 2.4, CABECA_CY + 2.6, 3.4)
  g.fill({ color: 0x000000, alpha: 0.1 })

  // destaque claro no topo (arredondado, acompanha a curva da cabeça em vez de um retângulo)
  g.circle(CABECA_CX - 2.4, CABECA_CY - 3, 2.9)
  g.fill({ color: 0xffffff, alpha: 0.24 })

  // bochecha
  g.circle(9.3, 8.5, 1.1)
  g.fill({ color: 0xffffff, alpha: 0.2 })

  // olhos - redondos com brilho
  g.circle(9.4, 7.3, 1.05)
  g.circle(14.6, 7.3, 1.05)
  g.fill({ color: COR_CONTORNO })
  g.circle(9.7, 6.9, 0.38)
  g.circle(14.9, 6.9, 0.38)
  g.fill({ color: 0xffffff })
}

/* ==================== barba (facial hair) ==================== */

export function desenharBarba(g: PixiGraphics, tipo: TipoBarba, corCabelo: number): void {
  g.clear()
  if (tipo === 'NENHUM') {
    return
  }

  if (tipo === 'BIGODE_FINO' || tipo === 'CAVANHAQUE_BIGODE') {
    g.roundRect(10.3, 9, 3.4, 0.7, 0.35)
    g.fill({ color: corCabelo })
    g.stroke({ width: 0.5, color: COR_CONTORNO })
  }
  if (tipo === 'BIGODE_GROSSO') {
    g.roundRect(10, 8.9, 4, 1.1, 0.55)
    g.fill({ color: corCabelo })
    g.stroke({ width: 0.6, color: COR_CONTORNO })
    g.circle(10, 9.5, 0.5)
    g.circle(14, 9.5, 0.5)
    g.fill({ color: corCabelo })
  }
  if (tipo === 'CAVANHAQUE' || tipo === 'CAVANHAQUE_BIGODE') {
    g.roundRect(10.6, 10.2, 2.8, 2, 1)
    g.fill({ color: corCabelo })
    g.stroke({ width: 0.8, color: COR_CONTORNO })
  }
  if (tipo === 'SUICAS') {
    g.roundRect(5.6, 6.4, 1.5, 3.4, 0.75)
    g.roundRect(16.9, 6.4, 1.5, 3.4, 0.75)
    g.fill({ color: corCabelo })
    g.stroke({ width: 0.7, color: COR_CONTORNO })
  }
  if (tipo === 'BARBA_CURTA') {
    g.ellipse(12, 10.6, 4.3, 1.6)
    g.fill({ color: corCabelo, alpha: 0.85 })
    g.stroke({ width: 0.8, color: COR_CONTORNO })
  }
  if (tipo === 'BARBA_CHEIA') {
    g.ellipse(12, 10.8, 4.7, 1.9)
    g.fill({ color: corCabelo })
    g.stroke({ width: 1, color: COR_CONTORNO })
    g.roundRect(9, 9.9, 3, 0.7, 0.4)
    g.fill({ color: 0xffffff, alpha: 0.15 })
  }
}

/* ==================== cabelo ==================== */

/** Cabelo como "touca" - uma elipse um pouco mais larga que a cabeça (dá volume, sobra um
 * pouquinho pras laterais) e baixa o bastante só até a altura da testa/sobrancelha, deixando o
 * rosto (olhos pra baixo) à mostra. É a técnica padrão de personagem em camadas sem boolean
 * subtraction: não dá pra "recortar" a cabeça, então o cabelo cobre só a metade de cima por
 * desenho, não por corte. */
function toucaCabelo(g: PixiGraphics, cor: number, largura = 6.6, altura = 4.3, cy = 2.6): void {
  g.ellipse(CABECA_CX, cy, largura, altura)
  g.fill({ color: cor })
  g.stroke({ width: 1, color: COR_CONTORNO })
  g.roundRect(CABECA_CX - largura + 1.4, cy - altura + 0.6, largura - 1, 1.5, 1)
  g.fill({ color: 0xffffff, alpha: 0.14 })
}

export function desenharCabelo(g: PixiGraphics, estilo: EstiloCabelo, cor: number): void {
  g.clear()
  if (estilo === 'CARECA') {
    return
  }

  if (estilo === 'RASPADO') {
    g.ellipse(CABECA_CX, 0.9, 6.2, 1.4)
    g.fill({ color: cor, alpha: 0.7 })
    g.stroke({ width: 0.8, color: COR_CONTORNO })
    return
  }

  if (estilo === 'MOICANO') {
    g.roundRect(10.4, -2.3, 3.2, 5.4, 1.5)
    g.fill({ color: cor })
    g.stroke({ width: 1, color: COR_CONTORNO })
    return
  }

  if (estilo === 'ESPETADO') {
    for (const x of [6.2, 9.1, 12, 14.9, 17.8]) {
      g.moveTo(x - 1.5, 3.2)
      g.lineTo(x, -3.2)
      g.lineTo(x + 1.5, 3.2)
      g.closePath()
    }
    g.fill({ color: cor })
    g.stroke({ width: 0.8, color: COR_CONTORNO })
    return
  }

  if (estilo === 'CACHEADO') {
    toucaCabelo(g, cor, 6.4, 2.6, 2)
    for (const [cx, cy] of [
      [7.2, 0.9],
      [9.7, -0.4],
      [12, -0.9],
      [14.3, -0.4],
      [16.8, 0.9],
    ] as const) {
      g.circle(cx, cy, 1.7)
    }
    g.fill({ color: cor })
    g.stroke({ width: 0.9, color: COR_CONTORNO })
    return
  }

  toucaCabelo(g, cor)

  if (estilo === 'REPARTIDO') {
    g.moveTo(9.2, -0.8)
    g.lineTo(10.6, 3.4)
    g.stroke({ width: 0.6, color: escurecer(cor, 0.35) })
  }

  if (estilo === 'RABO_DE_CAVALO') {
    g.roundRect(10.4, 5, 3.2, 7, 1.6)
    g.fill({ color: cor })
    g.stroke({ width: 1, color: COR_CONTORNO })
  }

  if (estilo === 'CHIQUINHAS') {
    g.circle(4.7, 4, 2)
    g.circle(19.3, 4, 2)
    g.fill({ color: cor })
    g.stroke({ width: 1, color: COR_CONTORNO })
  }

  if (estilo === 'LONGO') {
    g.roundRect(4.3, 3.2, 2.7, 6, 1.35)
    g.roundRect(17, 3.2, 2.7, 6, 1.35)
    g.fill({ color: cor })
    g.stroke({ width: 1, color: COR_CONTORNO })
    g.roundRect(4.3, 8.6, 2.5, 7, 1.25)
    g.roundRect(17.2, 8.6, 2.5, 7, 1.25)
    g.fill({ color: cor })
    g.stroke({ width: 1, color: COR_CONTORNO })
  }

  if (estilo === 'COQUE') {
    g.circle(12, -2.5, 2.2)
    g.fill({ color: cor })
    g.stroke({ width: 1, color: COR_CONTORNO })
  }
}

/* ==================== chapéu (hat) ==================== */

export function desenharChapeu(g: PixiGraphics, tipo: TipoChapeu, cor: number): void {
  g.clear()
  if (tipo === 'NENHUM') {
    return
  }

  switch (tipo) {
    case 'BONE':
      g.roundRect(5.3, -3, 13.4, 4.4, 3)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      g.roundRect(3.1, -0.7, 5.4, 1.6, 1)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      g.roundRect(6, -2.7, 5, 1.4, 0.8)
      g.fill({ color: 0xffffff, alpha: 0.2 })
      break
    case 'BONE_LATERAL':
      g.roundRect(5.3, -3, 13.4, 4.4, 3)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      g.roundRect(15.5, -1.7, 5.6, 1.6, 1)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      g.roundRect(6, -2.7, 5, 1.4, 0.8)
      g.fill({ color: 0xffffff, alpha: 0.2 })
      break
    case 'GORRO':
      g.roundRect(5, -3.6, 14, 6, 4)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      g.circle(12, -4.2, 1.4)
      g.fill({ color: 0xffffff })
      g.stroke({ width: 1, color: COR_CONTORNO })
      g.roundRect(5.6, -3.3, 5, 1.6, 0.9)
      g.fill({ color: 0xffffff, alpha: 0.16 })
      break
    case 'CHAPEU_PRAIA':
      g.ellipse(12, -1.3, 9.2, 2.2)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      g.roundRect(7.2, -4, 9.6, 3, 2)
      g.fill({ color: clarear(cor, 0.15) })
      g.stroke({ width: 1, color: COR_CONTORNO })
      break
    case 'BANDANA':
      g.roundRect(5.3, -2.5, 13.4, 3, 1.5)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      g.moveTo(18, -1)
      g.lineTo(20.5, 0.5)
      g.lineTo(18.5, 0.8)
      g.closePath()
      g.fill({ color: escurecer(cor, 0.2) })
      break
    case 'FAIXA':
      g.roundRect(5.3, -1.1, 13.4, 1.6, 0.8)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      break
    case 'CARTOLA':
      g.roundRect(7, -6.8, 10, 5, 1)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      g.roundRect(5, -2.4, 14, 1.3, 0.6)
      g.fill({ color: cor })
      g.stroke({ width: 1, color: COR_CONTORNO })
      g.roundRect(7, -3.8, 10, 1, 0.4)
      g.fill({ color: escurecer(cor, 0.35) })
      break
    case 'CAPACETE':
      g.circle(12, 4.4, 7.3)
      g.fill({ color: cor })
      g.stroke({ width: 1.2, color: COR_CONTORNO })
      g.roundRect(6, 6.6, 12, 1.5, 0.7)
      g.fill({ color: 0x2b2b3a, alpha: 0.7 })
      g.roundRect(7, 0.4, 5, 1.6, 0.8)
      g.fill({ color: 0xffffff, alpha: 0.2 })
      break
    case 'TIARA':
      g.roundRect(5.3, -1.4, 13.4, 1, 0.5)
      g.fill({ color: cor })
      g.stroke({ width: 0.8, color: COR_CONTORNO })
      g.circle(12, -1.1, 0.9)
      g.fill({ color: 0xffffff })
      g.stroke({ width: 0.6, color: COR_CONTORNO })
      break
  }
}

/* ==================== óculos (glasses) ==================== */

export function desenharOculos(g: PixiGraphics, tipo: TipoOculos, cor: number): void {
  g.clear()
  if (tipo === 'NENHUM') {
    return
  }

  const bridge = () => {
    g.moveTo(11, 7.2)
    g.lineTo(13, 7.2)
    g.stroke({ width: 1, color: cor })
  }

  switch (tipo) {
    case 'REDONDO':
      g.circle(9.4, 7.3, 1.7)
      g.circle(14.6, 7.3, 1.7)
      g.stroke({ width: 1, color: cor })
      bridge()
      break
    case 'QUADRADO':
      g.roundRect(7.9, 6, 3, 2.8, 0.6)
      g.roundRect(13.1, 6, 3, 2.8, 0.6)
      g.stroke({ width: 1, color: cor })
      bridge()
      break
    case 'AVIADOR':
      g.ellipse(9.4, 7.4, 1.9, 1.5)
      g.ellipse(14.6, 7.4, 1.9, 1.5)
      g.stroke({ width: 1, color: cor })
      bridge()
      break
    case 'ESCUROS':
      g.ellipse(9.4, 7.3, 1.8, 1.5)
      g.ellipse(14.6, 7.3, 1.8, 1.5)
      g.fill({ color: cor, alpha: 0.88 })
      g.stroke({ width: 1, color: COR_CONTORNO })
      bridge()
      break
    case 'CORACAO':
      for (const cx of [9.4, 14.6]) {
        g.circle(cx - 0.7, 6.8, 1)
        g.circle(cx + 0.7, 6.8, 1)
        g.moveTo(cx - 1.6, 7.3)
        g.lineTo(cx, 8.7)
        g.lineTo(cx + 1.6, 7.3)
        g.closePath()
      }
      g.fill({ color: cor, alpha: 0.85 })
      g.stroke({ width: 0.8, color: COR_CONTORNO })
      bridge()
      break
    case 'ESTRELA':
      for (const cx of [9.4, 14.6]) {
        g.moveTo(cx, 5.6)
        g.lineTo(cx + 0.7, 7)
        g.lineTo(cx + 1.9, 7.1)
        g.lineTo(cx + 0.9, 8)
        g.lineTo(cx + 1.2, 9.2)
        g.lineTo(cx, 8.5)
        g.lineTo(cx - 1.2, 9.2)
        g.lineTo(cx - 0.9, 8)
        g.lineTo(cx - 1.9, 7.1)
        g.lineTo(cx - 0.7, 7)
        g.closePath()
      }
      g.fill({ color: cor, alpha: 0.85 })
      g.stroke({ width: 0.6, color: COR_CONTORNO })
      break
    case 'MEIA_LUA':
      g.arc(9.4, 9.1, 1.6, Math.PI, 0)
      g.arc(14.6, 9.1, 1.6, Math.PI, 0)
      g.stroke({ width: 1, color: cor })
      break
    case 'MASCARA_MERGULHO':
      g.roundRect(7.4, 5.8, 9.2, 3.2, 1.6)
      g.fill({ color: cor, alpha: 0.75 })
      g.stroke({ width: 1, color: COR_CONTORNO })
      g.moveTo(7.4, 6.5)
      g.lineTo(4.8, 6.1)
      g.moveTo(16.6, 6.5)
      g.lineTo(19.2, 6.1)
      g.stroke({ width: 0.8, color: COR_CONTORNO })
      break
    case 'TAPA_OLHO':
      g.circle(9.4, 7.3, 1.7)
      g.fill({ color: COR_CONTORNO })
      g.moveTo(11.1, 6.5)
      g.lineTo(18, 3.5)
      g.stroke({ width: 0.8, color: COR_CONTORNO })
      break
  }
}

/* ==================== outro (acessório de peito/pescoço) ==================== */

export function desenharOutro(g: PixiGraphics, tipo: EstiloOutro, cor: number): void {
  g.clear()
  if (tipo === 'NENHUM') {
    return
  }

  switch (tipo) {
    case 'BRINCO':
      g.circle(6, 8, 0.55)
      g.circle(18, 8, 0.55)
      g.fill({ color: cor })
      g.stroke({ width: 0.4, color: COR_CONTORNO })
      break
    case 'COLAR':
      g.arc(12, 11.6, 4, 0.25 * Math.PI, 0.75 * Math.PI)
      g.stroke({ width: 0.9, color: cor })
      g.circle(12, 15.3, 0.7)
      g.fill({ color: cor })
      g.stroke({ width: 0.5, color: COR_CONTORNO })
      break
    case 'LENCO':
      g.moveTo(8.5, 12.4)
      g.lineTo(15.5, 12.4)
      g.lineTo(12, 15.6)
      g.closePath()
      g.fill({ color: cor })
      g.stroke({ width: 0.8, color: COR_CONTORNO })
      break
    case 'GRAVATA':
      g.moveTo(10.8, 12.6)
      g.lineTo(13.2, 12.6)
      g.lineTo(12.8, 14.4)
      g.lineTo(12, 21)
      g.lineTo(11.2, 14.4)
      g.closePath()
      g.fill({ color: cor })
      g.stroke({ width: 0.7, color: COR_CONTORNO })
      break
    case 'LACO':
      g.moveTo(12, 13)
      g.lineTo(9, 11.8)
      g.lineTo(9, 14.2)
      g.closePath()
      g.moveTo(12, 13)
      g.lineTo(15, 11.8)
      g.lineTo(15, 14.2)
      g.closePath()
      g.fill({ color: cor })
      g.stroke({ width: 0.7, color: COR_CONTORNO })
      g.circle(12, 13, 0.6)
      g.fill({ color: escurecer(cor, 0.2) })
      break
    case 'BROCHE':
      g.moveTo(12, 14.3)
      g.lineTo(12.9, 15.6)
      g.lineTo(11.1, 15.6)
      g.closePath()
      g.fill({ color: cor })
      g.stroke({ width: 0.6, color: COR_CONTORNO })
      break
    case 'MICROFONE':
      g.roundRect(11.4, 13, 1.2, 2.4, 0.6)
      g.fill({ color: cor })
      g.stroke({ width: 0.5, color: COR_CONTORNO })
      g.moveTo(12, 15.4)
      g.lineTo(12, 17)
      g.stroke({ width: 0.4, color: COR_CONTORNO })
      break
  }
}

/* ==================== indicador de status + anéis ==================== */

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
