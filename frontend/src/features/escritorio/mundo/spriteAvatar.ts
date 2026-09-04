import type {
  AparenciaAvatar,
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
import type { MaterialClasse } from './paletteRecolor'

/**
 * Mapa enum -> asset de pixel art real (Liberated Pixel Cup / Universal LPC Spritesheet Character
 * Generator, ver `frontend/public/personagem-lpc/CREDITS.md`) - substitui o antigo desenho por
 * código (`avatarFactory.ts`/`PixelCharacterSvg.tsx`, apagados nesta virada). Os enums do backend
 * NÃO mudaram (zero migração) - só o que cada valor "significa" visualmente mudou, de um `case` de
 * `PIXI.Graphics` pra um caminho de spritesheet real.
 *
 * Cada spritesheet é 576×256px = 9 quadros de animação × 4 linhas de direção (norte/oeste/sul/
 * leste, nessa ordem - confirmado no código-fonte do gerador, não suposto), 64×64px por quadro.
 *
 * Duas famílias de asset, misturadas dentro da mesma categoria quando preciso (o LPC não é
 * uniforme nisso - ver `PALETTE_RECOLOR_GUIDE.md` do projeto):
 * - `recolor`: 1 arquivo só, pintado numa cor de referência - `paletteRecolor.ts` troca a rampa de
 *   referência pela rampa gerada a partir da cor escolhida no editor, em tempo real.
 * - `prebaked`: o LPC já exporta 1 PNG pronto por nome de cor (não dá pra recolorir via canvas
 *   porque não usa a convenção de rampa de referência) - aqui a "cor" escolhida no editor só
 *   seleciona qual arquivo pronto usar (a cor mais próxima já foi resolvida na curadoria, ver
 *   `scratchpad/lpc/build-assets.mjs` usado pra gerar esses arquivos).
 */

const BASE = '/personagem-lpc'

export type MaterialPorCategoria = MaterialClasse

export interface CamadaRecolor {
  tipo: 'recolor'
  url: string
  material: MaterialClasse
}

export interface CamadaPrebaked {
  tipo: 'prebaked'
  /** chave = hex exato de `CORES_GERAL` (mesma paleta validada no backend) */
  porCor: Record<string, string>
}

export type Camada = CamadaRecolor | CamadaPrebaked

function recolor(url: string, material: MaterialClasse): CamadaRecolor {
  return { tipo: 'recolor', url, material }
}

/** z-order entre categorias (não entre quadros/direções) - dos `zPos` reais do LPC
 * (`sheet_definitions/**\/*.json`), não inventado: corpo(10) < calça(20) < sapato(25) < top(35) <
 * jaqueta(55) < colar/outro(~100) < barba(110) < óculos(115) < cabelo(120) < chapéu(130+). */
export const Z_POS = {
  skin: 10,
  bottom: 20,
  shoes: 25,
  top: 35,
  jacket: 55,
  other: 100,
  facialHair: 110,
  glasses: 115,
  hair: 120,
  hat: 132,
} as const

/** Corpo base - não é uma escolha de enum, é sempre esta 1 silhueta (decisão da curadoria:
 * "1 gênero de base pro avatar, silhueta neutra"), só a cor (`corPele`) muda via recolor. */
export const CAMADA_PELE: CamadaRecolor = recolor(`${BASE}/skin/base.png`, 'pele')

export const CAMADA_HAIR: Partial<Record<EstiloCabelo, CamadaRecolor>> = {
  RASPADO: recolor(`${BASE}/hair/RASPADO.png`, 'cabelo'),
  CURTO: recolor(`${BASE}/hair/CURTO.png`, 'cabelo'),
  REPARTIDO: recolor(`${BASE}/hair/REPARTIDO.png`, 'cabelo'),
  CACHEADO: recolor(`${BASE}/hair/CACHEADO.png`, 'cabelo'),
  MOICANO: recolor(`${BASE}/hair/MOICANO.png`, 'cabelo'),
  RABO_DE_CAVALO: recolor(`${BASE}/hair/RABO_DE_CAVALO.png`, 'cabelo'),
  CHIQUINHAS: recolor(`${BASE}/hair/CHIQUINHAS.png`, 'cabelo'),
  LONGO: recolor(`${BASE}/hair/LONGO.png`, 'cabelo'),
  COQUE: recolor(`${BASE}/hair/COQUE.png`, 'cabelo'),
  ESPETADO: recolor(`${BASE}/hair/ESPETADO.png`, 'cabelo'),
  // CARECA: sem sprite de propósito (careca = sem camada de cabelo)
}

/** Barba/bigode reaproveita `corCabelo` (o modelo de dados nunca teve `corBarba` própria - já era
 * assim antes, no `avatarFactory.ts`). */
export const CAMADA_FACIAL_HAIR: Partial<Record<TipoBarba, CamadaRecolor>> = {
  BIGODE_FINO: recolor(`${BASE}/facial-hair/BIGODE_FINO.png`, 'cabelo'),
  BIGODE_GROSSO: recolor(`${BASE}/facial-hair/BIGODE_GROSSO.png`, 'cabelo'),
  CAVANHAQUE: recolor(`${BASE}/facial-hair/CAVANHAQUE.png`, 'cabelo'),
  SUICAS: recolor(`${BASE}/facial-hair/SUICAS.png`, 'cabelo'),
  BARBA_CURTA: recolor(`${BASE}/facial-hair/BARBA_CURTA.png`, 'cabelo'),
  BARBA_CHEIA: recolor(`${BASE}/facial-hair/BARBA_CHEIA.png`, 'cabelo'),
  CAVANHAQUE_BIGODE: recolor(`${BASE}/facial-hair/CAVANHAQUE_BIGODE.png`, 'cabelo'),
}

export const CAMADA_TOP: Partial<Record<EstiloTop, CamadaRecolor>> = {
  CAMISETA: recolor(`${BASE}/top/CAMISETA.png`, 'tecido'),
  REGATA: recolor(`${BASE}/top/REGATA.png`, 'tecido'),
  POLO: recolor(`${BASE}/top/POLO.png`, 'tecido'),
  CAMISA: recolor(`${BASE}/top/CAMISA.png`, 'tecido'),
  SUETER: recolor(`${BASE}/top/SUETER.png`, 'tecido'),
  LISTRADA: recolor(`${BASE}/top/LISTRADA.png`, 'tecido'),
  GOLA_V: recolor(`${BASE}/top/GOLA_V.png`, 'tecido'),
  GOLA_ALTA: recolor(`${BASE}/top/GOLA_ALTA.png`, 'tecido'),
  MOLETOM_LEVE: recolor(`${BASE}/top/MOLETOM_LEVE.png`, 'tecido'),
}

/** As 16 cores de `CORES_GERAL` (aparenciaAvatar.ts) - chave exata usada em toda `CamadaPrebaked`
 * abaixo (é a mesma paleta compartilhada por Top/Jacket/Bottom/Shoes/Hat/Glasses/Other). */
function prebakedJaqueta(pasta: string, porArquivo: Record<string, string>): CamadaPrebaked {
  const porCor: Record<string, string> = {}
  for (const [hex, arquivo] of Object.entries(porArquivo)) porCor[hex] = `${BASE}/jacket/${pasta}/${arquivo}`
  return { tipo: 'prebaked', porCor }
}

const CORES_JAQUETA_MULTI = {
  '#1c1a28': 'black.png',
  '#2b2b3a': 'navy.png',
  '#6b7280': 'slate.png',
  '#8a5a34': 'brown.png',
  '#c9a24a': 'yellow.png',
  '#e8a33d': 'yellow.png',
  '#e0546f': 'rose.png',
  '#e874c4': 'pink.png',
  '#8a4fd6': 'purple.png',
  '#4472c4': 'blue.png',
  '#4fa8d6': 'bluegray.png',
  '#4f9f6f': 'slate.png',
  '#2f6f45': 'green.png',
  '#c0392b': 'red.png',
  '#f2f2f2': 'white.png',
  '#ffffff': 'white.png',
}

const CORES_MOLETOM_CAPUZ_UNICA = Object.fromEntries(Object.keys(CORES_JAQUETA_MULTI).map((hex) => [hex, 'black.png']))

const CORES_CASACO_LONGO = {
  '#1c1a28': 'dark_gray.png',
  '#2b2b3a': 'dark_gray.png',
  '#6b7280': 'gray.png',
  '#8a5a34': 'dark_gray.png',
  '#c9a24a': 'gray.png',
  '#e8a33d': 'gray.png',
  '#e0546f': 'gray.png',
  '#e874c4': 'gray.png',
  '#8a4fd6': 'gray.png',
  '#4472c4': 'gray.png',
  '#4fa8d6': 'gray.png',
  '#4f9f6f': 'gray.png',
  '#2f6f45': 'dark_gray.png',
  '#c0392b': 'gray.png',
  '#f2f2f2': 'gray.png',
  '#ffffff': 'gray.png',
}

export const CAMADA_JACKET: Partial<Record<EstiloJaqueta, Camada>> = {
  // pasta pré-colorida (sem arquivo único recolorável, ver build-assets.mjs) - a "cor" escolhida
  // no editor só seleciona qual PNG pronto usar.
  JEANS: prebakedJaqueta('JEANS', CORES_JAQUETA_MULTI),
  BLAZER: prebakedJaqueta('BLAZER', CORES_JAQUETA_MULTI),
  MOLETOM_CAPUZ: prebakedJaqueta('MOLETOM_CAPUZ', CORES_MOLETOM_CAPUZ_UNICA),
  COLETE: prebakedJaqueta('COLETE', CORES_JAQUETA_MULTI),
  CASACO_LONGO: prebakedJaqueta('CASACO_LONGO', CORES_CASACO_LONGO),
  BOMBER: prebakedJaqueta('BOMBER', CORES_JAQUETA_MULTI),
  // essas duas são arquivo único recolorável de verdade (mesma família do top/bottom/etc.)
  CARDIGA: recolor(`${BASE}/jacket/CARDIGA.png`, 'tecido'),
  COURO: recolor(`${BASE}/jacket/COURO.png`, 'tecido'),
}

export const CAMADA_BOTTOM: Partial<Record<EstiloBottom, CamadaRecolor>> = {
  CALCA: recolor(`${BASE}/bottom/CALCA.png`, 'tecido'),
  JEANS: recolor(`${BASE}/bottom/JEANS.png`, 'tecido'),
  LEGGING: recolor(`${BASE}/bottom/LEGGING.png`, 'tecido'),
  SHORT: recolor(`${BASE}/bottom/SHORT.png`, 'tecido'),
  BERMUDA: recolor(`${BASE}/bottom/BERMUDA.png`, 'tecido'),
  SHORT_JEANS: recolor(`${BASE}/bottom/SHORT_JEANS.png`, 'tecido'),
  SAIA: recolor(`${BASE}/bottom/SAIA.png`, 'tecido'),
  SAIA_LONGA: recolor(`${BASE}/bottom/SAIA_LONGA.png`, 'tecido'),
  CALCA_LISTRADA: recolor(`${BASE}/bottom/CALCA_LISTRADA.png`, 'tecido'),
}

export const CAMADA_SHOES: Partial<Record<EstiloSapato, CamadaRecolor>> = {
  TENIS: recolor(`${BASE}/shoes/TENIS.png`, 'tecido'),
  SOCIAL: recolor(`${BASE}/shoes/SOCIAL.png`, 'tecido'),
  BOTA: recolor(`${BASE}/shoes/BOTA.png`, 'tecido'),
  BOTA_CANO_ALTO: recolor(`${BASE}/shoes/BOTA_CANO_ALTO.png`, 'tecido'),
  SANDALIA: recolor(`${BASE}/shoes/SANDALIA.png`, 'tecido'),
  CHINELO: recolor(`${BASE}/shoes/CHINELO.png`, 'tecido'),
  SALTO: recolor(`${BASE}/shoes/SALTO.png`, 'tecido'),
  // DESCALCO: sem sprite de propósito
}

export const CAMADA_HAT: Partial<Record<TipoChapeu, CamadaRecolor>> = {
  BONE: recolor(`${BASE}/hat/BONE.png`, 'tecido'),
  BONE_LATERAL: recolor(`${BASE}/hat/BONE_LATERAL.png`, 'tecido'),
  GORRO: recolor(`${BASE}/hat/GORRO.png`, 'tecido'),
  CHAPEU_PRAIA: recolor(`${BASE}/hat/CHAPEU_PRAIA.png`, 'tecido'),
  BANDANA: recolor(`${BASE}/hat/BANDANA.png`, 'tecido'),
  FAIXA: recolor(`${BASE}/hat/FAIXA.png`, 'tecido'),
  CARTOLA: recolor(`${BASE}/hat/CARTOLA.png`, 'tecido'),
  CAPACETE: recolor(`${BASE}/hat/CAPACETE.png`, 'tecido'),
  TIARA: recolor(`${BASE}/hat/TIARA.png`, 'tecido'),
}

export const CAMADA_GLASSES: Partial<Record<TipoOculos, CamadaRecolor>> = {
  REDONDO: recolor(`${BASE}/glasses/REDONDO.png`, 'tecido'),
  QUADRADO: recolor(`${BASE}/glasses/QUADRADO.png`, 'tecido'),
  AVIADOR: recolor(`${BASE}/glasses/AVIADOR.png`, 'tecido'),
  ESCUROS: recolor(`${BASE}/glasses/ESCUROS.png`, 'tecido'),
  CORACAO: recolor(`${BASE}/glasses/CORACAO.png`, 'tecido'),
  ESTRELA: recolor(`${BASE}/glasses/ESTRELA.png`, 'tecido'),
  MEIA_LUA: recolor(`${BASE}/glasses/MEIA_LUA.png`, 'tecido'),
  MASCARA_MERGULHO: recolor(`${BASE}/glasses/MASCARA_MERGULHO.png`, 'tecido'),
  TAPA_OLHO: recolor(`${BASE}/glasses/TAPA_OLHO.png`, 'tecido'),
}

export const CAMADA_OTHER: Partial<Record<EstiloOutro, CamadaRecolor>> = {
  BRINCO: recolor(`${BASE}/other/BRINCO.png`, 'tecido'),
  COLAR: recolor(`${BASE}/other/COLAR.png`, 'tecido'),
  LENCO: recolor(`${BASE}/other/LENCO.png`, 'tecido'),
  GRAVATA: recolor(`${BASE}/other/GRAVATA.png`, 'tecido'),
  LACO: recolor(`${BASE}/other/LACO.png`, 'tecido'),
  BROCHE: recolor(`${BASE}/other/BROCHE.png`, 'tecido'),
  // MICROFONE: sem equivalente razoável no LPC, sem sprite (só o rótulo existe na UI)
}

/** Resolve a camada final (URL + o que fazer com a cor escolhida) pra uma célula `CamadaPrebaked` -
 * a cor sempre bate exato com uma das 16 de `CORES_GERAL` (validada no backend), então é lookup
 * direto, sem distância. */
export function resolverPrebaked(camada: CamadaPrebaked, corHex: string): string {
  return camada.porCor[corHex] ?? Object.values(camada.porCor)[0]
}

/** As 10 categorias do editor (mesma ordem de `Z_POS`, crescente = desenhada por cima). */
export const CHAVES_CAMADA = ['skin', 'bottom', 'shoes', 'top', 'jacket', 'other', 'facialHair', 'glasses', 'hair', 'hat'] as const
export type ChaveCamada = (typeof CHAVES_CAMADA)[number]

export interface CamadaResolvida {
  url: string
  /** `null` = já é a imagem final (camada `prebaked`), não passa pelo canvas de recolorir. */
  material: MaterialClasse | null
  corAlvo: string | null
}

/** Junta os 10 mapas de cima num só - a função que `AvatarPixi`/`PersonagemPreview` realmente
 * chamam pra saber "o que desenhar" a partir de uma `AparenciaAvatar`. `null` numa categoria = sem
 * sprite ali agora (CARECA, NENHUM, NENHUMA, DESCALCO, MICROFONE). */
export function montarCamadas(aparencia: AparenciaAvatar): Record<ChaveCamada, CamadaResolvida | null> {
  function deRecolor(camada: CamadaRecolor | undefined, corAlvo: string): CamadaResolvida | null {
    return camada ? { url: camada.url, material: camada.material, corAlvo } : null
  }

  const jaqueta = CAMADA_JACKET[aparencia.estiloJaqueta]
  let camadaJaqueta: CamadaResolvida | null = null
  if (jaqueta) {
    camadaJaqueta =
      jaqueta.tipo === 'recolor'
        ? { url: jaqueta.url, material: jaqueta.material, corAlvo: aparencia.corJaqueta }
        : { url: resolverPrebaked(jaqueta, aparencia.corJaqueta), material: null, corAlvo: null }
  }

  return {
    skin: { url: CAMADA_PELE.url, material: CAMADA_PELE.material, corAlvo: aparencia.corPele },
    hair: deRecolor(CAMADA_HAIR[aparencia.estiloCabelo], aparencia.corCabelo),
    facialHair: deRecolor(CAMADA_FACIAL_HAIR[aparencia.tipoBarba], aparencia.corCabelo),
    top: deRecolor(CAMADA_TOP[aparencia.estiloTop], aparencia.corTop),
    jacket: camadaJaqueta,
    bottom: deRecolor(CAMADA_BOTTOM[aparencia.estiloBottom], aparencia.corBottom),
    shoes: deRecolor(CAMADA_SHOES[aparencia.estiloSapato], aparencia.corSapato),
    hat: deRecolor(CAMADA_HAT[aparencia.chapeu], aparencia.corChapeu),
    glasses: deRecolor(CAMADA_GLASSES[aparencia.oculos], aparencia.corOculos),
    other: deRecolor(CAMADA_OTHER[aparencia.estiloOutro], aparencia.corOutro),
  }
}
