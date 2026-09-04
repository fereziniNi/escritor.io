import type { Graphics as PixiGraphics } from 'pixi.js'
import type { TipoZona, Zona } from '../types'
import { TILE_PX } from './constantes'
import type { ItemMobilia } from './tipos'

/**
 * "Fábrica" de desenho procedural do mundo - móveis/piso continuam 100% `PIXI.Graphics` (forma
 * geométrica simples com contorno), diferente do personagem (`AvatarPixi.tsx`/
 * `PersonagemPreview.tsx`), que passou a usar pixel art real (LPC, ver `spriteAvatar.ts`) depois
 * do pedido do usuário "não faça mais o personagem com svg... mude a estrutura dele".
 *
 * Fase 6 (pedido "mais vivo, mais parecido com o Gather", com prints reais como referência):
 * comparado ao Gather de verdade, o que faltava aqui não era falta de móvel, era tudo ser um
 * `fill` único chapado, sem sombra, num piso universal com só um tingimento fraco por cima. Este
 * arquivo ganhou sombra sob cada item (`desenharSombra`), sombreamento em 2 tons em cada peça
 * (`comDestaque*`), e piso com material/cor própria por sala (`desenharPisoZonas`) em vez do
 * tingimento translúcido de antes - sem copiar nenhum sprite literal do Gather (só a composição/
 * estilo de referência), ver o plano ("Fase 6") pra decisão completa.
 */

/* ==================== piso ==================== */

const COR_PISO_CLARO = 0xeef2f6
const COR_PISO_ESCURO = 0xdfe6ec
const COR_LINHA_PISO = 0x2a3a4a
const ALPHA_LINHA_PISO = 0.08

/** Piso do corredor/área aberta (fora de qualquer zona) - tabuleiro neutro claro/azulado, mesmo
 * de antes. As salas por cima ganham o próprio material em `desenharPisoZonas`. */
export function desenharPiso(g: PixiGraphics, larguraTiles: number, alturaTiles: number): void {
  g.clear()
  for (let ty = 0; ty < alturaTiles; ty++) {
    for (let tx = 0; tx < larguraTiles; tx++) {
      const par = (tx + ty) % 2 === 0
      g.rect(tx * TILE_PX, ty * TILE_PX, TILE_PX, TILE_PX)
      g.fill({ color: par ? COR_PISO_CLARO : COR_PISO_ESCURO })
    }
  }
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

interface MaterialZona {
  /** 'losango' (hachura em X formando losangos, tipo tapete/carpete xadrez diagonal), 'xadrez'
   * (tabuleiro 2 tons, tipo azulejo) ou 'tramado' (base lisa + pontinhos, tipo carpete flocado). */
  padrao: 'losango' | 'xadrez' | 'tramado'
  corA: number
  corB: number
  /** Tom da faixa decorativa da borda superior (balcão/parede baixa só visual, sem colisão). */
  corFaixa: number
}

/** Uma cor-base bem distinta por tipo de sala (não mais um tingimento fraco sobre um piso
 * universal) - inspirado nos pisos visivelmente diferentes por cômodo dos prints de referência do
 * Gather que o usuário mandou, sem copiar o sprite/textura literal deles. */
const MATERIAL_POR_ZONA: Record<TipoZona, MaterialZona> = {
  REUNIAO: { padrao: 'losango', corA: 0xaec3e6, corB: 0x8fabd4, corFaixa: 0x3f5a86 },
  CAFE: { padrao: 'xadrez', corA: 0xf0d9a8, corB: 0xe3c48a, corFaixa: 0x9c6f38 },
  FOCO: { padrao: 'tramado', corA: 0xe1d5b4, corB: 0xc9b384, corFaixa: 0x7c6742 },
  LIVRE: { padrao: 'losango', corA: 0xdccaf0, corB: 0xc3a8e6, corFaixa: 0x6c4a94 },
  ATENDIMENTO: { padrao: 'xadrez', corA: 0xf0c9d1, corB: 0xe0a7b3, corFaixa: 0x943f52 },
}

const ALTURA_FAIXA_TILES = 0.42

function desenharPisoXadrezZona(g: PixiGraphics, zona: Zona, corA: number, corB: number): void {
  for (let ty = 0; ty < zona.altura; ty++) {
    for (let tx = 0; tx < zona.largura; tx++) {
      const par = (tx + ty) % 2 === 0
      g.rect((zona.x + tx) * TILE_PX, (zona.y + ty) * TILE_PX, TILE_PX, TILE_PX)
      g.fill({ color: par ? corA : corB })
    }
  }
}

/** Hachura em X por tile (não uma diagonal de ponta a ponta da sala) - cada segmento nasce e
 * morre dentro dos 4 cantos do próprio tile, então nunca escapa do retângulo da zona por
 * construção (uma diagonal única "de sala inteira" vaza pra fora do retângulo em zonas que não são
 * quadradas - largura e altura em tiles diferentes -, bug visto na 1ª versão desta função: o
 * losango "vazava" hachura pro corredor e pras salas vizinhas). Repetido tile a tile, o olho lê
 * como o mesmo carpete em losango contínuo. */
function desenharPisoLosangoZona(g: PixiGraphics, zona: Zona, corBase: number, corLinha: number): void {
  g.rect(zona.x * TILE_PX, zona.y * TILE_PX, zona.largura * TILE_PX, zona.altura * TILE_PX)
  g.fill({ color: corBase })

  for (let ty = 0; ty < zona.altura; ty++) {
    for (let tx = 0; tx < zona.largura; tx++) {
      const x0 = (zona.x + tx) * TILE_PX
      const y0 = (zona.y + ty) * TILE_PX
      g.moveTo(x0, y0)
      g.lineTo(x0 + TILE_PX, y0 + TILE_PX)
      g.moveTo(x0 + TILE_PX, y0)
      g.lineTo(x0, y0 + TILE_PX)
    }
  }
  g.stroke({ width: 1, color: corLinha, alpha: 0.4 })
}

/** Base lisa + um pontinho por tile - lê como carpete flocado/texturizado, sem virar um tabuleiro
 * xadrez nem uma hachura de linhas. */
function desenharPisoTramadoZona(g: PixiGraphics, zona: Zona, corBase: number, corPonto: number): void {
  g.rect(zona.x * TILE_PX, zona.y * TILE_PX, zona.largura * TILE_PX, zona.altura * TILE_PX)
  g.fill({ color: corBase })
  for (let ty = 0; ty < zona.altura; ty++) {
    for (let tx = 0; tx < zona.largura; tx++) {
      const cx = (zona.x + tx) * TILE_PX + TILE_PX / 2
      const cy = (zona.y + ty) * TILE_PX + TILE_PX / 2
      g.circle(cx, cy, 2.4)
    }
  }
  g.fill({ color: corPonto, alpha: 0.45 })
}

/** Faixa decorativa na borda superior da sala - o "balcão/parede baixa" só visual dos prints de
 * referência (pedido do usuário: "remover as paredes" continua valendo - isso aqui não tem
 * colisão nenhuma, é só uma banda de cor mais escura pintada no chão). */
function desenharFaixaSuperior(g: PixiGraphics, zona: Zona, corFaixa: number): void {
  g.rect(zona.x * TILE_PX, zona.y * TILE_PX, zona.largura * TILE_PX, ALTURA_FAIXA_TILES * TILE_PX)
  g.fill({ color: corFaixa, alpha: 0.92 })
}

/** Substitui o antigo `desenharZonas` (tingimento translúcido sobre o piso universal) - cada sala
 * agora tem material/cor própria de verdade, mais a faixa decorativa da borda superior. */
export function desenharPisoZonas(g: PixiGraphics, zonas: Zona[]): void {
  g.clear()
  for (const zona of zonas) {
    const material = MATERIAL_POR_ZONA[zona.tipo]
    if (material.padrao === 'xadrez') {
      desenharPisoXadrezZona(g, zona, material.corA, material.corB)
    } else if (material.padrao === 'losango') {
      desenharPisoLosangoZona(g, zona, material.corA, material.corB)
    } else {
      desenharPisoTramadoZona(g, zona, material.corA, material.corB)
    }
    desenharFaixaSuperior(g, zona, material.corFaixa)
  }
}

/* ==================== sombra ==================== */

/** Elipse escura translúcida sob um item (móvel ou avatar) - sozinha é a mudança de maior impacto
 * pro "tudo parece um recorte colado no chão" (pedido do usuário). Sempre chamada ANTES do
 * desenho do item em si, deslocada um pouco pra baixo (a "luz" vem de cima). */
export function desenharSombra(g: PixiGraphics, cx: number, cy: number, largura: number, altura: number): void {
  g.ellipse(cx, cy + altura * 0.36, largura * 0.44, altura * 0.24)
  g.fill({ color: 0x000000, alpha: 0.17 })
}

/* ---------- móveis/decoração ---------- */

function desenharMesa(g: PixiGraphics, cx: number, cy: number, rotacao: number): void {
  const girada = rotacao === 90 || rotacao === 270
  const largura = girada ? TILE_PX * 0.55 : TILE_PX * 0.8
  const altura = girada ? TILE_PX * 0.8 : TILE_PX * 0.55
  desenharSombra(g, cx, cy, largura, altura)
  g.roundRect(cx - largura / 2, cy - altura / 2, largura, altura, 3)
  g.fill({ color: 0x8a5a34 })
  g.stroke({ width: 1.5, color: 0x4a3728 })
  // destaque claro no canto superior-esquerdo (2º tom) - tira a mesa do "chapado".
  g.roundRect(cx - largura / 2 + 1.5, cy - altura / 2 + 1.5, largura * 0.55, altura * 0.4, 2)
  g.fill({ color: 0xa87a4e, alpha: 0.55 })
  const larguraMonitor = largura * 0.35
  const alturaMonitor = altura * 0.35
  g.roundRect(cx - larguraMonitor / 2, cy - alturaMonitor / 2, larguraMonitor, alturaMonitor, 1)
  g.fill({ color: 0x3c4a5a })
  g.roundRect(cx - larguraMonitor / 2 + 1, cy - alturaMonitor / 2 + 1, larguraMonitor * 0.5, alturaMonitor * 0.35, 0.5)
  g.fill({ color: 0x6f96b8, alpha: 0.6 })
}

function desenharCadeira(g: PixiGraphics, cx: number, cy: number): void {
  desenharSombra(g, cx, cy, TILE_PX * 0.44, TILE_PX * 0.44)
  g.circle(cx, cy, TILE_PX * 0.22)
  g.fill({ color: 0x5c4a3a })
  g.stroke({ width: 1.2, color: 0x2e2418 })
  g.circle(cx - TILE_PX * 0.06, cy - TILE_PX * 0.06, TILE_PX * 0.09)
  g.fill({ color: 0x836650, alpha: 0.6 })
}

/** Exportada (diferente das outras `desenhar*` de móvel) porque `PlantaAnimada.tsx` (Fase 6) a usa
 * dentro de um container próprio que balança sozinho - a planta não passa mais pelo lote estático
 * de `desenharMobilia`. */
export function desenharPlanta(g: PixiGraphics, cx: number, cy: number): void {
  desenharSombra(g, cx, cy, TILE_PX * 0.5, TILE_PX * 0.3)
  g.roundRect(cx - TILE_PX * 0.16, cy + TILE_PX * 0.05, TILE_PX * 0.32, TILE_PX * 0.2, 2)
  g.fill({ color: 0x8a5a34 })
  g.stroke({ width: 1, color: 0x4a3728 })
  g.circle(cx, cy - TILE_PX * 0.05, TILE_PX * 0.22)
  g.circle(cx - TILE_PX * 0.14, cy, TILE_PX * 0.16)
  g.circle(cx + TILE_PX * 0.14, cy, TILE_PX * 0.16)
  g.fill({ color: 0x4f8f6f })
  g.stroke({ width: 1, color: 0x2e5540 })
  // brilho de folha (2º tom) num dos círculos, sempre o mesmo lado - dá volume sem parecer aleatório.
  g.circle(cx - TILE_PX * 0.04, cy - TILE_PX * 0.1, TILE_PX * 0.08)
  g.fill({ color: 0x7fc79a, alpha: 0.65 })
}

function desenharEstante(g: PixiGraphics, cx: number, cy: number, rotacao: number): void {
  const girada = rotacao === 90 || rotacao === 270
  const largura = girada ? TILE_PX * 0.3 : TILE_PX * 0.85
  const altura = girada ? TILE_PX * 0.85 : TILE_PX * 0.3
  desenharSombra(g, cx, cy, largura, altura)
  g.rect(cx - largura / 2, cy - altura / 2, largura, altura)
  g.fill({ color: 0x6b4a2f })
  g.stroke({ width: 1.5, color: 0x3a2a1a })
  g.rect(cx - largura / 2 + 1.5, cy - altura / 2 + 1.5, largura - 3, altura * 0.35)
  g.fill({ color: 0x8f6a45, alpha: 0.55 })
}

function desenharBalcao(g: PixiGraphics, cx: number, cy: number, rotacao: number): void {
  const girado = rotacao === 90 || rotacao === 270
  const largura = girado ? TILE_PX * 0.4 : TILE_PX * 0.9
  const altura = girado ? TILE_PX * 0.9 : TILE_PX * 0.4
  desenharSombra(g, cx, cy, largura, altura)
  g.rect(cx - largura / 2, cy - altura / 2, largura, altura)
  g.fill({ color: 0xd9b98a })
  g.stroke({ width: 1.5, color: 0x8a5a34 })
  g.rect(cx - largura / 2 + 1.5, cy - altura / 2 + 1.5, largura - 3, altura * 0.4)
  g.fill({ color: 0xf0dcb8, alpha: 0.6 })
}

function desenharTapete(g: PixiGraphics, cx: number, cy: number): void {
  g.roundRect(cx - TILE_PX * 0.9, cy - TILE_PX * 0.6, TILE_PX * 1.8, TILE_PX * 1.2, 6)
  g.fill({ color: 0xe0a94f, alpha: 0.55 })
}

/** Sofá de "sala fora do trabalho" - um retângulo comprido com um encosto (faixa mais escura de
 * um dos lados) e "braços" nas pontas. */
function desenharSofa(g: PixiGraphics, cx: number, cy: number, rotacao: number): void {
  const girado = rotacao === 90 || rotacao === 270
  const largura = girado ? TILE_PX * 0.55 : TILE_PX * 1.7
  const altura = girado ? TILE_PX * 1.7 : TILE_PX * 0.55
  desenharSombra(g, cx, cy, largura, altura)
  g.roundRect(cx - largura / 2, cy - altura / 2, largura, altura, 6)
  g.fill({ color: 0x6f8fa8 })
  g.stroke({ width: 1.5, color: 0x3f5a6e })
  // encosto - faixa mais escura de um dos lados compridos
  if (girado) {
    g.roundRect(cx - largura / 2, cy - altura / 2, largura * 0.4, altura, 4)
  } else {
    g.roundRect(cx - largura / 2, cy - altura / 2, largura, altura * 0.4, 4)
  }
  g.fill({ color: 0x5a7890 })
  // almofada clara (2º tom) no meio do assento
  if (girado) {
    g.roundRect(cx - largura * 0.1, cy - altura * 0.32, largura * 0.35, altura * 0.28, 3)
  } else {
    g.roundRect(cx - largura * 0.32, cy - altura * 0.1, largura * 0.28, altura * 0.35, 3)
  }
  g.fill({ color: 0x93b4cc, alpha: 0.7 })
}

/** Mesa de jogos (estilo ping-pong) - retângulo verde com linha central branca + "raquetes" nas
 * bordas, pro "canto de descanso" ter algo mais lúdico que só sofá/tapete. */
function desenharMesaJogos(g: PixiGraphics, cx: number, cy: number, rotacao: number): void {
  const girado = rotacao === 90 || rotacao === 270
  const largura = girado ? TILE_PX * 0.9 : TILE_PX * 1.7
  const altura = girado ? TILE_PX * 1.7 : TILE_PX * 0.9
  desenharSombra(g, cx, cy, largura, altura)
  g.roundRect(cx - largura / 2, cy - altura / 2, largura, altura, 3)
  g.fill({ color: 0x3a8f5c })
  g.stroke({ width: 1.5, color: 0x1c1a28 })
  g.roundRect(cx - largura / 2 + 1.5, cy - altura / 2 + 1.5, largura - 3, altura * 0.3)
  g.fill({ color: 0x63b985, alpha: 0.5 })
  if (girado) {
    g.moveTo(cx - largura / 2 + 3, cy)
    g.lineTo(cx + largura / 2 - 3, cy)
  } else {
    g.moveTo(cx, cy - altura / 2 + 3)
    g.lineTo(cx, cy + altura / 2 - 3)
  }
  g.stroke({ width: 1.5, color: 0xffffff, alpha: 0.85 })
  // raquete (pá vermelha com cabo curto) numa das pontas
  const raqueteX = girado ? cx : cx - largura / 2 - TILE_PX * 0.08
  const raqueteY = girado ? cy - altura / 2 - TILE_PX * 0.08 : cy
  g.circle(raqueteX, raqueteY, TILE_PX * 0.1)
  g.fill({ color: 0xc0392b })
  g.stroke({ width: 1, color: 0x1c1a28 })
}

/** Aquário decorativo - só o "tanque" (vidro + cascalho), sem peixe: os peixes agora nadam de
 * verdade em `AquarioAnimado.tsx` (Fase 6, "nada se move sozinho" era uma queixa explícita do
 * usuário), então este item saiu de `desenharMobilia`/`MOBILIA_MUNDO` e virou um componente
 * próprio renderizado direto em `CamadaMundo`. */
export function desenharTanqueAquario(g: PixiGraphics): void {
  g.clear()
  const largura = TILE_PX * 0.84
  const altura = TILE_PX * 0.6
  g.roundRect(-largura / 2, -altura / 2, largura, altura, 3)
  g.fill({ color: 0x8fd0e8, alpha: 0.75 })
  g.stroke({ width: 1.5, color: 0x3a5a68 })
  // cascalho no fundo do tanque
  g.rect(-largura / 2 + 2, altura / 2 - 4, largura - 4, 3)
  g.fill({ color: 0xd9c48a, alpha: 0.85 })
}

/** Peixinho do aquário - corpo oval + cauda triangular, centrado em (0,0) local (quem chama
 * posiciona via `x`/`y` do próprio `<pixiGraphics>`, mesmo padrão das pernas do avatar em
 * `AvatarPixi.tsx`). Usado por `AquarioAnimado.tsx` (Fase 6) pra nadar de verdade via `useTick`,
 * em vez do pontinho estático que existia antes dentro de `desenharAquario`. */
export function desenharPeixinho(g: PixiGraphics, corCorpo = 0xe8873a): void {
  g.clear()
  g.ellipse(0, 0, 4, 2.2)
  g.fill({ color: corCorpo })
  g.moveTo(-4, 0)
  g.lineTo(-6.5, -2)
  g.lineTo(-6.5, 2)
  g.closePath()
  g.fill({ color: corCorpo, alpha: 0.85 })
}

function desenharQuadro(g: PixiGraphics, cx: number, cy: number, rotacao: number): void {
  const girado = rotacao === 90 || rotacao === 270
  const largura = girado ? TILE_PX * 0.4 : TILE_PX * 0.55
  const altura = girado ? TILE_PX * 0.55 : TILE_PX * 0.4
  g.roundRect(cx - largura / 2, cy - altura / 2, largura, altura, 2)
  g.fill({ color: 0xe8dcc4 })
  g.stroke({ width: 2, color: 0x5a4530 })
  // "arte" abstrata dentro da moldura (blocos de cor, tipo Mondrian) - decorativo, sem repetir a
  // mesma composição em todo quadro (varia pela paridade da posição, sem precisar de estado extra).
  const variante = (Math.round(cx) + Math.round(cy)) % 2 === 0
  const corBloco = variante ? 0xd65f5f : 0x4f79c9
  g.rect(cx - largura / 2 + 2, cy - altura / 2 + 2, largura * 0.45, altura - 4)
  g.fill({ color: corBloco })
  g.rect(cx + largura * 0.02, cy - altura / 2 + 2, largura * 0.4, altura * 0.4)
  g.fill({ color: 0xe0c23e })
}

function desenharBebedouro(g: PixiGraphics, cx: number, cy: number): void {
  const largura = TILE_PX * 0.4
  const altura = TILE_PX * 0.62
  desenharSombra(g, cx, cy, largura, altura)
  g.roundRect(cx - largura / 2, cy - altura / 2 + TILE_PX * 0.08, largura, altura - TILE_PX * 0.08, 2)
  g.fill({ color: 0xdfe6ec })
  g.stroke({ width: 1.3, color: 0x8a97a3 })
  // garrafão azul no topo
  g.roundRect(cx - largura * 0.34, cy - altura / 2, largura * 0.68, altura * 0.4, 4)
  g.fill({ color: 0x5aa8d6, alpha: 0.85 })
  g.stroke({ width: 1, color: 0x2f6f96 })
}

function desenharArmario(g: PixiGraphics, cx: number, cy: number, rotacao: number): void {
  const girado = rotacao === 90 || rotacao === 270
  const largura = girado ? TILE_PX * 0.34 : TILE_PX * 0.5
  const altura = girado ? TILE_PX * 0.5 : TILE_PX * 0.34
  desenharSombra(g, cx, cy, largura, altura)
  g.rect(cx - largura / 2, cy - altura / 2, largura, altura)
  g.fill({ color: 0x8d97a3 })
  g.stroke({ width: 1.4, color: 0x4a5460 })
  // linhas de gaveta
  const linhas = girado ? 2 : 3
  for (let i = 1; i < linhas; i++) {
    const y = cy - altura / 2 + (altura / linhas) * i
    g.moveTo(cx - largura / 2 + 2, y)
    g.lineTo(cx + largura / 2 - 2, y)
  }
  g.stroke({ width: 1, color: 0x4a5460, alpha: 0.7 })
}

/** Pufe/sofá-bola - cores variadas (rosa/roxo/azul/laranja) escolhidas pela posição do item, sem
 * precisar de um campo `cor` extra em `ItemMobilia`. */
const CORES_PUF = [0xe07ba0, 0x8a6fd6, 0x5aa8d6, 0xe8a94a]
function desenharPuf(g: PixiGraphics, cx: number, cy: number): void {
  desenharSombra(g, cx, cy, TILE_PX * 0.52, TILE_PX * 0.52)
  const cor = CORES_PUF[(Math.round(cx / TILE_PX) + Math.round(cy / TILE_PX)) % CORES_PUF.length]
  g.circle(cx, cy, TILE_PX * 0.26)
  g.fill({ color: cor })
  g.stroke({ width: 1.4, color: 0x2a2438 })
  g.circle(cx - TILE_PX * 0.07, cy - TILE_PX * 0.07, TILE_PX * 0.1)
  g.fill({ color: 0xffffff, alpha: 0.35 })
}

function desenharCafeteira(g: PixiGraphics, cx: number, cy: number): void {
  const largura = TILE_PX * 0.4
  const altura = TILE_PX * 0.32
  desenharSombra(g, cx, cy, largura, altura)
  g.roundRect(cx - largura / 2, cy - altura / 2, largura, altura, 2)
  g.fill({ color: 0x4a4a58 })
  g.stroke({ width: 1.2, color: 0x24242e })
  g.roundRect(cx - largura * 0.28, cy - altura / 2 - TILE_PX * 0.05, largura * 0.56, TILE_PX * 0.1, 1)
  g.fill({ color: 0x6f6f80 })
  // bica/jarra
  g.circle(cx, cy + altura * 0.1, largura * 0.16)
  g.fill({ color: 0x8a5a34, alpha: 0.85 })
}

/** Desenha os móveis/decoração - tapetes primeiro (ficam por baixo dos demais itens), depois o
 * resto na ordem em que aparecem em `dadosMundo.MOBILIA_MUNDO`. `aquario`/`planta` NÃO passam por
 * aqui (viraram componentes animados próprios, ver `AquarioAnimado.tsx`/`PlantaAnimada.tsx`) - só
 * chega aqui quem `CamadaMundo` filtra pra dentro do lote estático. */
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
      case 'sofa':
        desenharSofa(g, cx, cy, rotacao)
        break
      case 'mesaJogos':
        desenharMesaJogos(g, cx, cy, rotacao)
        break
      case 'quadro':
        desenharQuadro(g, cx, cy, rotacao)
        break
      case 'bebedouro':
        desenharBebedouro(g, cx, cy)
        break
      case 'armario':
        desenharArmario(g, cx, cy, rotacao)
        break
      case 'puf':
        desenharPuf(g, cx, cy)
        break
      case 'cafeteira':
        desenharCafeteira(g, cx, cy)
        break
      case 'aquario':
        // não desenhado aqui - ver comentário da função.
        break
    }
  }
}
