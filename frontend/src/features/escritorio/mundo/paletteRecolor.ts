import { Rectangle, Texture } from 'pixi.js'

/**
 * Recolorir de verdade (canvas 2D), não desenho por forma - parte da virada "sprite de pixel art
 * modular" (LPC, ver `spriteAvatar.ts`). Cada sprite fonte (corpo/roupa/cabelo) é pintado usando
 * uma "rampa de referência" de 6 tons (a mesma convenção do `PALETTE_RECOLOR_GUIDE.md` do projeto
 * original: pele usa a rampa `light`, cabelo usa `orange`, tecido/roupa usa `white`). Recolorir é
 * achar, pixel a pixel, qual dos 6 tons de referência aquele pixel mais se parece e trocar pelo
 * tom correspondente de uma rampa "alvo" gerada a partir da cor única escolhida no editor
 * (`CORES_PELE`/`CORES_CABELO`/`CORES_GERAL` só têm 1 hex por opção - a rampa de 6 tons com
 * sombra/luz é gerada preservando a variação de luminosidade da rampa de referência, só trocando
 * matiz/saturação pra a da cor escolhida).
 *
 * Não é o shader WebGL do projeto original (`PALETTE_RECOLOR_GUIDE.md`) - overkill pro volume
 * daqui. É CPU/canvas, com cache por (imagem, material, cor-alvo) - mesmo princípio de "só recalcula
 * se a combinação mudou" que as rodadas de performance desta sessão já estabeleceram noutros
 * lugares (`useTick` sem `useState`).
 */

export type MaterialClasse = 'pele' | 'cabelo' | 'tecido'

/** Frame nativo de cada sprite LPC: 576×256px = 9 colunas (quadros de animação) × 4 linhas
 * (direção). Confirmado no código-fonte do gerador (`sources/custom-animations.ts`), não suposto:
 * as linhas são norte/oeste/sul/leste, nessa ordem. */
export const TAMANHO_QUADRO = 64
export const COLUNAS_QUADRO = 9
export const LINHAS_DIRECAO = 4

export type Direcao = 'norte' | 'oeste' | 'sul' | 'leste'
export const LINHA_DA_DIRECAO: Record<Direcao, number> = { norte: 0, oeste: 1, sul: 2, leste: 3 }

/** Rampa de referência (6 tons, escuro -> claro) de cada material - hex exatos tirados de
 * `palette_definitions/{body,hair,cloth}/*_ulpc.json` do LPC (entradas `light`/`orange`/`white`,
 * o "base" de cada classe de material segundo `meta_*.json`). */
const RAMPAS_REFERENCIA: Record<MaterialClasse, string[]> = {
  pele: ['#271920', '#99423c', '#cc8665', '#e4a47c', '#f9d5ba', '#faece7'],
  cabelo: ['#260d14', '#6a1108', '#a42600', '#bf4000', '#e55600', '#ff8a00'],
  tecido: ['#281820', '#4d4a5d', '#958080', '#c4b59f', '#e5e6c7', '#ffffff'],
}

function hexParaRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}

function rgbParaHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0)
  else if (max === gn) h = (bn - rn) / d + 2
  else h = (rn - gn) / d + 4
  return [h / 6, s, l]
}

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t
  if (tt < 0) tt += 1
  if (tt > 1) tt -= 1
  if (tt < 1 / 6) return p + (q - p) * 6 * tt
  if (tt < 1 / 2) return q
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
  return p
}

function hslParaRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = l * 255
    return [v, v, v]
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255]
}

/** Gera a rampa alvo de 6 tons a partir de 1 cor só (a cor escolhida no editor) - preserva o
 * padrão de luz/sombra da rampa de referência daquele material (delta de luminosidade de cada tom
 * em relação à média da rampa), só troca matiz/saturação pela da cor alvo. */
function gerarRampaAlvo(material: MaterialClasse, hexAlvo: string): [number, number, number][] {
  const [hAlvo, sAlvo, lAlvo] = rgbParaHsl(...hexParaRgb(hexAlvo))
  const ls = RAMPAS_REFERENCIA[material].map((hex) => rgbParaHsl(...hexParaRgb(hex))[2])
  const lMedia = ls.reduce((a, b) => a + b, 0) / ls.length
  return ls.map((l) => hslParaRgb(hAlvo, sAlvo, Math.min(1, Math.max(0, lAlvo + (l - lMedia)))))
}

const TOLERANCIA_POR_CANAL = 10

function indiceMaisProximo(r: number, g: number, b: number, referencia: [number, number, number][]): number {
  let melhor = -1
  let melhorDist = Infinity
  for (let i = 0; i < referencia.length; i++) {
    const [rr, rg, rb] = referencia[i]
    const d = (r - rr) ** 2 + (g - rg) ** 2 + (b - rb) ** 2
    if (d < melhorDist) {
      melhorDist = d
      melhor = i
    }
  }
  return melhorDist <= TOLERANCIA_POR_CANAL ** 2 * 3 ? melhor : -1
}

function carregarImagem(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`falha ao carregar sprite: ${url}`))
    img.src = url
  })
}

async function construirCanvas(url: string, material: MaterialClasse | null, hexAlvo: string | null): Promise<HTMLCanvasElement> {
  const img = await carregarImagem(url)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.drawImage(img, 0, 0)
  if (!material || !hexAlvo) {
    return canvas // camada "pré-colorida" (ver spriteAvatar.ts) - usada como está, sem recolorir
  }
  const dados = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const referenciaRgb = RAMPAS_REFERENCIA[material].map((hex) => hexParaRgb(hex)) as [number, number, number][]
  const alvoRgb = gerarRampaAlvo(material, hexAlvo)
  const px = dados.data
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue
    const idx = indiceMaisProximo(px[i], px[i + 1], px[i + 2], referenciaRgb)
    if (idx >= 0) {
      const [r, g, b] = alvoRgb[idx]
      px[i] = r
      px[i + 1] = g
      px[i + 2] = b
    }
  }
  ctx.putImageData(dados, 0, 0)
  return canvas
}

/** Cache por (url, material, cor-alvo) - `material`/`hexAlvo` nulos = imagem usada como está (caso
 * das camadas "pré-coloridas", ver `spriteAvatar.ts`), sem passar pelo canvas de recolorir. Nível
 * mais baixo (canvas puro) compartilhado por `obterTexturaCamada` (mundo Pixi) e
 * `avatar/PersonagemPreview.tsx` (canvas 2D simples, sem Pixi) - a mesma folha recolorida uma vez
 * só, os dois só desenham ela de formas diferentes. */
const cacheCanvas = new Map<string, Promise<HTMLCanvasElement>>()

export function obterCanvasCamada(url: string, material: MaterialClasse | null, hexAlvo: string | null): Promise<HTMLCanvasElement> {
  const chave = material && hexAlvo ? `${url}|${material}|${hexAlvo}` : url
  let promessa = cacheCanvas.get(chave)
  if (!promessa) {
    promessa = construirCanvas(url, material, hexAlvo)
    cacheCanvas.set(chave, promessa)
  }
  return promessa
}

export async function obterTexturaCamada(url: string, material: MaterialClasse | null, hexAlvo: string | null): Promise<Texture> {
  const canvas = await obterCanvasCamada(url, material, hexAlvo)
  return Texture.from(canvas)
}

/** Recorta a folha completa (576×256) nos 36 quadros (9 colunas × 4 linhas) - view sobre a mesma
 * `source`, sem duplicar pixels. Cacheado por instância de `Texture` (a folha só é construída uma
 * vez por chave em `obterTexturaCamada`, então a identidade do objeto é estável). */
const cacheQuadros = new WeakMap<Texture, Texture[]>()

export function obterQuadrosDaFolha(folha: Texture): Texture[] {
  let quadros = cacheQuadros.get(folha)
  if (!quadros) {
    quadros = []
    for (let linha = 0; linha < LINHAS_DIRECAO; linha++) {
      for (let coluna = 0; coluna < COLUNAS_QUADRO; coluna++) {
        quadros.push(new Texture({ source: folha.source, frame: new Rectangle(coluna * TAMANHO_QUADRO, linha * TAMANHO_QUADRO, TAMANHO_QUADRO, TAMANHO_QUADRO) }))
      }
    }
    cacheQuadros.set(folha, quadros)
  }
  return quadros
}

/** Índice do quadro (0-35) dado direção + posição no ciclo de 9 quadros. */
export function indiceDoQuadro(direcao: Direcao, quadro: number): number {
  return LINHA_DA_DIRECAO[direcao] * COLUNAS_QUADRO + (((quadro % COLUNAS_QUADRO) + COLUNAS_QUADRO) % COLUNAS_QUADRO)
}
