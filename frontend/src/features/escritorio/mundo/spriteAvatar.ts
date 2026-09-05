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
  TipoCorpo,
  TipoOculos,
  TipoRosto,
} from '../avatar/aparenciaAvatar'
import { COR_OLHO_PADRAO, type EspecificacaoRecolor, type MaterialClasse } from './paletteRecolor'

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
  /** Corte feminino (LPC "female"/"thin", dependendo da categoria) - quando existe, usado no
   * lugar de `url` para `tipoCorpo === 'FEMININO'`. Ausente = o LPC não tem corte feminino desse
   * item específico (a minoria - ver comentário de `CAMADA_TOP`/`CAMADA_JACKET`); o corte
   * masculino é usado como aproximação nesse caso, risco visual documentado, não travado. */
  urlFeminino?: string
  material: MaterialClasse
}

export interface CamadaPrebaked {
  tipo: 'prebaked'
  /** chave = hex exato de `CORES_GERAL` (mesma paleta validada no backend) */
  porCor: Record<string, string>
  /** mesma ideia de `CamadaRecolor.urlFeminino`, pra quem é pré-colorido. */
  porCorFeminino?: Record<string, string>
}

export type Camada = CamadaRecolor | CamadaPrebaked

function recolor(url: string, material: MaterialClasse, urlFeminino?: string): CamadaRecolor {
  return { tipo: 'recolor', url, material, urlFeminino }
}

/** z-order entre categorias (não entre quadros/direções) - dos `zPos` reais do LPC
 * (`sheet_definitions/**\/*.json`), não inventado: corpo(10) < calça(20) < sapato(25) < top(35) <
 * jaqueta(55) < colar/outro(~90) < cabeça(100) < barba(110) < óculos(115) < cabelo(120) <
 * chapéu(130+). */
export const Z_POS = {
  skin: 10,
  bottom: 20,
  shoes: 25,
  top: 35,
  jacket: 55,
  other: 90,
  head: 100,
  facialHair: 110,
  glasses: 115,
  hair: 120,
  hat: 132,
} as const

/** Corpo base - até aqui era sempre a mesma silhueta masculina ("1 gênero de base pro avatar,
 * silhueta neutra", decisão da curadoria original) até o usuário apontar "O personagem pode ser
 * masculino ou feminino também!". Agora tem as 2 silhuetas do próprio LPC (`body/bodies/male` e
 * `body/bodies/female`) - só a cor (`corPele`) continua mudando via recolor, igual antes. */
export const CAMADA_PELE: Record<TipoCorpo, CamadaRecolor> = {
  MASCULINO: recolor(`${BASE}/skin/MASCULINO.png`, 'pele'),
  FEMININO: recolor(`${BASE}/skin/FEMININO.png`, 'pele'),
}

/** Cabeça/rosto - camada separada do corpo no próprio LPC (`spritesheets/head/heads/*`), achada
 * só depois do usuário reportar "meu personagem está sem o rosto": o `skin/base.png`
 * (`body/bodies/male`) é só torso+pernas, sem cabeça nenhuma - o LPC deixa a cabeça numa hierarquia
 * à parte de propósito (dá pra trocar o formato da cabeça sem trocar o corpo). Isso também é o que
 * permite a categoria "Face" (pedido seguinte do usuário: "quero poder escolher qual face irei
 * utilizar... quero poder trocar o rosto").
 *
 * 22 formatos de cabeça (dobrou de 8 pra 16 depois do usuário reclamar que as opções originais
 * "trazem poucas diferenças" - eram só variação sutil de formato humano; depois foi de 16 pra 22
 * porque o usuário pediu mais rostos especificamente HUMANOS). As 15 humanas (`recolorir: true`)
 * usam `corPele` - a imagem já vem com pele E olho pintados em 2 rampas de referência diferentes
 * na MESMA textura (`heads_human_*.json`: `color_1` = pele, `color_2` = olho), daí
 * `especificacoesCabeca` devolver 2 specs em vez do helper `recolor` de 1 spec só. As 6 opções
 * `_MARCANTE`/`_DELICADO` são as mesmas 4 cabeças-base compostas com nariz+sobrancelha (overlays
 * do próprio LPC, pré-compostos numa imagem só - o LPC não tem mais formatos de cabeça humana
 * disponíveis, só esses 4 restavam pra combinar). As 7 últimas são criaturas do próprio LPC
 * (goblin/vampiro/lobo/etc., `recolorir: false`) - cor própria fixa (verde do goblin, marrom do
 * lobo...), NÃO respondem à cor de pele escolhida - forçar a rampa de pele humana nelas ficaria
 * estranho (e olho já vem pintado na própria arte de cada uma). */
interface CamadaHead {
  url: string
  recolorir: boolean
}

function camadaHead(arquivo: string, recolorir: boolean): CamadaHead {
  return { url: `${BASE}/head/${arquivo}.png`, recolorir }
}

export const CAMADA_HEAD: Record<TipoRosto, CamadaHead> = {
  PADRAO: camadaHead('PADRAO', true),
  OVAL: camadaHead('OVAL', true),
  ENVELHECIDA: camadaHead('ENVELHECIDA', true),
  OVAL_ENVELHECIDA: camadaHead('OVAL_ENVELHECIDA', true),
  MAGRA: camadaHead('MAGRA', true),
  ROBUSTA: camadaHead('ROBUSTA', true),
  PEQUENA: camadaHead('PEQUENA', true),
  OVAL_PEQUENA: camadaHead('OVAL_PEQUENA', true),
  IDOSA_PEQUENA: camadaHead('IDOSA_PEQUENA', true),
  // _MARCANTE/_DELICADO: mesmas cabeças-base humanas, compostas com nariz+sobrancelha em build
  // time (scratchpad/lpc/compor-rostos.py) - ainda recolorem com corPele normalmente.
  PADRAO_MARCANTE: camadaHead('PADRAO_MARCANTE', true),
  PADRAO_DELICADO: camadaHead('PADRAO_DELICADO', true),
  OVAL_MARCANTE: camadaHead('OVAL_MARCANTE', true),
  OVAL_DELICADO: camadaHead('OVAL_DELICADO', true),
  ENVELHECIDA_MARCANTE: camadaHead('ENVELHECIDA_MARCANTE', true),
  OVAL_ENVELHECIDA_MARCANTE: camadaHead('OVAL_ENVELHECIDA_MARCANTE', true),
  ALIENIGENA: camadaHead('ALIENIGENA', false),
  GOBLIN: camadaHead('GOBLIN', false),
  VAMPIRO: camadaHead('VAMPIRO', false),
  LOBO: camadaHead('LOBO', false),
  COELHO: camadaHead('COELHO', false),
  ORC: camadaHead('ORC', false),
  MINOTAURO: camadaHead('MINOTAURO', false),
}

export function especificacoesCabeca(corPele: string): EspecificacaoRecolor[] {
  return [
    { material: 'pele', corAlvo: corPele },
    { material: 'olho', corAlvo: COR_OLHO_PADRAO },
  ]
}

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

/** LISTRADA/GOLA_ALTA não têm corte feminino no LPC (só "male") - ficam com o masculino como
 * aproximação pro corpo feminino, risco visual documentado no `urlFeminino` da interface. */
export const CAMADA_TOP: Partial<Record<EstiloTop, CamadaRecolor>> = {
  CAMISETA: recolor(`${BASE}/top/CAMISETA.png`, 'tecido', `${BASE}/top/CAMISETA_F.png`),
  REGATA: recolor(`${BASE}/top/REGATA.png`, 'tecido', `${BASE}/top/REGATA_F.png`),
  POLO: recolor(`${BASE}/top/POLO.png`, 'tecido', `${BASE}/top/POLO_F.png`),
  CAMISA: recolor(`${BASE}/top/CAMISA.png`, 'tecido', `${BASE}/top/CAMISA_F.png`),
  SUETER: recolor(`${BASE}/top/SUETER.png`, 'tecido', `${BASE}/top/SUETER_F.png`),
  LISTRADA: recolor(`${BASE}/top/LISTRADA.png`, 'tecido'),
  GOLA_V: recolor(`${BASE}/top/GOLA_V.png`, 'tecido', `${BASE}/top/GOLA_V_F.png`),
  GOLA_ALTA: recolor(`${BASE}/top/GOLA_ALTA.png`, 'tecido'),
  MOLETOM_LEVE: recolor(`${BASE}/top/MOLETOM_LEVE.png`, 'tecido', `${BASE}/top/MOLETOM_LEVE_F.png`),
}

/** As 16 cores de `CORES_GERAL` (aparenciaAvatar.ts) - chave exata usada em toda `CamadaPrebaked`
 * abaixo (é a mesma paleta compartilhada por Top/Jacket/Bottom/Shoes/Hat/Glasses/Other).
 * `pastaFeminina` opcional - só BOMBER (`tabard`) tem corte feminino pré-colorido no LPC entre as
 * pré-coloridas; as outras 5 ficam sem, mesmo risco documentado de `CamadaRecolor.urlFeminino`. */
function prebakedJaqueta(pasta: string, porArquivo: Record<string, string>, pastaFeminina?: string): CamadaPrebaked {
  const porCor: Record<string, string> = {}
  for (const [hex, arquivo] of Object.entries(porArquivo)) porCor[hex] = `${BASE}/jacket/${pasta}/${arquivo}`
  if (!pastaFeminina) return { tipo: 'prebaked', porCor }
  const porCorFeminino: Record<string, string> = {}
  for (const [hex, arquivo] of Object.entries(porArquivo)) porCorFeminino[hex] = `${BASE}/jacket/${pastaFeminina}/${arquivo}`
  return { tipo: 'prebaked', porCor, porCorFeminino }
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
  // única pré-colorida com corte feminino no LPC (tabard/female)
  BOMBER: prebakedJaqueta('BOMBER', CORES_JAQUETA_MULTI, 'BOMBER_F'),
  // essas duas são arquivo único recolorável de verdade (mesma família do top/bottom/etc.)
  CARDIGA: recolor(`${BASE}/jacket/CARDIGA.png`, 'tecido', `${BASE}/jacket/CARDIGA_F.png`),
  // COURO não tem corte feminino no LPC (torso/jacket/santa só tem "male")
  COURO: recolor(`${BASE}/jacket/COURO.png`, 'tecido'),
}

/** Todas as 9 têm corte feminino no LPC (variante "thin") - cobertura completa aqui, diferente de
 * Top/Jacket. */
export const CAMADA_BOTTOM: Partial<Record<EstiloBottom, CamadaRecolor>> = {
  CALCA: recolor(`${BASE}/bottom/CALCA.png`, 'tecido', `${BASE}/bottom/CALCA_F.png`),
  JEANS: recolor(`${BASE}/bottom/JEANS.png`, 'tecido', `${BASE}/bottom/JEANS_F.png`),
  LEGGING: recolor(`${BASE}/bottom/LEGGING.png`, 'tecido', `${BASE}/bottom/LEGGING_F.png`),
  SHORT: recolor(`${BASE}/bottom/SHORT.png`, 'tecido', `${BASE}/bottom/SHORT_F.png`),
  BERMUDA: recolor(`${BASE}/bottom/BERMUDA.png`, 'tecido', `${BASE}/bottom/BERMUDA_F.png`),
  SHORT_JEANS: recolor(`${BASE}/bottom/SHORT_JEANS.png`, 'tecido', `${BASE}/bottom/SHORT_JEANS_F.png`),
  SAIA: recolor(`${BASE}/bottom/SAIA.png`, 'tecido', `${BASE}/bottom/SAIA_F.png`),
  SAIA_LONGA: recolor(`${BASE}/bottom/SAIA_LONGA.png`, 'tecido', `${BASE}/bottom/SAIA_LONGA_F.png`),
  CALCA_LISTRADA: recolor(`${BASE}/bottom/CALCA_LISTRADA.png`, 'tecido', `${BASE}/bottom/CALCA_LISTRADA_F.png`),
}

/** Todas as 7 têm corte feminino no LPC (variante "thin") - cobertura completa aqui também. */
export const CAMADA_SHOES: Partial<Record<EstiloSapato, CamadaRecolor>> = {
  TENIS: recolor(`${BASE}/shoes/TENIS.png`, 'tecido', `${BASE}/shoes/TENIS_F.png`),
  SOCIAL: recolor(`${BASE}/shoes/SOCIAL.png`, 'tecido', `${BASE}/shoes/SOCIAL_F.png`),
  BOTA: recolor(`${BASE}/shoes/BOTA.png`, 'tecido', `${BASE}/shoes/BOTA_F.png`),
  BOTA_CANO_ALTO: recolor(`${BASE}/shoes/BOTA_CANO_ALTO.png`, 'tecido', `${BASE}/shoes/BOTA_CANO_ALTO_F.png`),
  SANDALIA: recolor(`${BASE}/shoes/SANDALIA.png`, 'tecido', `${BASE}/shoes/SANDALIA_F.png`),
  CHINELO: recolor(`${BASE}/shoes/CHINELO.png`, 'tecido', `${BASE}/shoes/CHINELO_F.png`),
  SALTO: recolor(`${BASE}/shoes/SALTO.png`, 'tecido', `${BASE}/shoes/SALTO_F.png`),
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
 * direto, sem distância. `porCorFeminino` só existe pra BOMBER - as outras pré-coloridas caem no
 * masculino de qualquer jeito quando não tem versão feminina. */
export function resolverPrebaked(camada: CamadaPrebaked, corHex: string, tipoCorpo: TipoCorpo): string {
  const mapa = (tipoCorpo === 'FEMININO' && camada.porCorFeminino) || camada.porCor
  return mapa[corHex] ?? Object.values(mapa)[0]
}

/** As 11 categorias do editor, mesma ordem de `Z_POS`, crescente = desenhada por cima. */
export const CHAVES_CAMADA = ['skin', 'bottom', 'shoes', 'top', 'jacket', 'other', 'head', 'facialHair', 'glasses', 'hair', 'hat'] as const
export type ChaveCamada = (typeof CHAVES_CAMADA)[number]

export interface CamadaResolvida {
  url: string
  /** Lista vazia = já é a imagem final (camada `prebaked`), não passa pelo canvas de recolorir. */
  especificacoes: EspecificacaoRecolor[]
}

/** Junta os mapas de cima num só - a função que `AvatarPixi`/`PersonagemPreview` realmente chamam
 * pra saber "o que desenhar" a partir de uma `AparenciaAvatar`. `null` numa categoria = sem sprite
 * ali agora (CARECA, NENHUM, NENHUMA, DESCALCO, MICROFONE). */
export function montarCamadas(aparencia: AparenciaAvatar): Record<ChaveCamada, CamadaResolvida | null> {
  function deRecolor(camada: CamadaRecolor | undefined, corAlvo: string): CamadaResolvida | null {
    if (!camada) return null
    const url = aparencia.tipoCorpo === 'FEMININO' && camada.urlFeminino ? camada.urlFeminino : camada.url
    return { url, especificacoes: [{ material: camada.material, corAlvo }] }
  }

  const jaqueta = CAMADA_JACKET[aparencia.estiloJaqueta]
  let camadaJaqueta: CamadaResolvida | null = null
  if (jaqueta) {
    camadaJaqueta =
      jaqueta.tipo === 'recolor'
        ? deRecolor(jaqueta, aparencia.corJaqueta)
        : { url: resolverPrebaked(jaqueta, aparencia.corJaqueta, aparencia.tipoCorpo), especificacoes: [] }
  }

  const pele = CAMADA_PELE[aparencia.tipoCorpo]

  return {
    skin: { url: pele.url, especificacoes: [{ material: pele.material, corAlvo: aparencia.corPele }] },
    head: (() => {
      const cabeca = CAMADA_HEAD[aparencia.tipoRosto]
      return { url: cabeca.url, especificacoes: cabeca.recolorir ? especificacoesCabeca(aparencia.corPele) : [] }
    })(),
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
