// Resolve a mapeamento enum -> asset LPC real, copia os walk.png escolhidos pra
// frontend/public/personagem-lpc/ e gera CREDITS.md agregando os créditos reais de cada um
// (CREDITS.csv na raiz do clone, chave = caminho do arquivo dentro de spritesheets/).
import { existsSync, mkdirSync, copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'

const REPO = 'C:/Users/leanc/AppData/Local/Temp/claude/c--Users-leanc-claude-code-escritor-io/3f67526c-169f-4507-b0cc-087ed8373608/scratchpad/lpc/repo'
const OUT = 'c:/Users/leanc/claude_code/escritor.io/frontend/public/personagem-lpc'

// --- parser CSV simples (respeita aspas, o CREDITS.csv usa vírgula como separador de coluna
// e dentro de campos multi-valor tb, mas cada campo inteiro vem entre aspas) ---
function parseCsv(texto) {
  const linhas = []
  let campo = '', linha = [], dentroDeAspas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (dentroDeAspas) {
      if (c === '"') {
        if (texto[i + 1] === '"') { campo += '"'; i++ } else { dentroDeAspas = false }
      } else campo += c
    } else {
      if (c === '"') dentroDeAspas = true
      else if (c === ',') { linha.push(campo); campo = '' }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && texto[i + 1] === '\n') i++
        linha.push(campo); campo = ''
        if (linha.length > 1 || linha[0] !== '') linhas.push(linha)
        linha = []
      } else campo += c
    }
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha) }
  return linhas
}

console.log('lendo CREDITS.csv...')
const csvLinhas = parseCsv(readFileSync(join(REPO, 'CREDITS.csv'), 'utf8'))
const header = csvLinhas[0]
const idxFile = header.indexOf('filename')
const idxNotes = header.indexOf('notes')
const idxAuthors = header.indexOf('authors')
const idxLicenses = header.indexOf('licenses')
const idxUrls = header.indexOf('urls')

const creditsByFile = new Map()
for (let i = 1; i < csvLinhas.length; i++) {
  const l = csvLinhas[i]
  if (!l[idxFile]) continue
  creditsByFile.set(l[idxFile].trim(), {
    notes: (l[idxNotes] || '').trim(),
    authors: (l[idxAuthors] || '').split(',').map((s) => s.trim()).filter(Boolean),
    licenses: (l[idxLicenses] || '').split(',').map((s) => s.trim()).filter(Boolean),
    urls: (l[idxUrls] || '').split(',').map((s) => s.trim()).filter(Boolean),
  })
}
console.log(`CREDITS.csv: ${creditsByFile.size} entradas`)

function acharCredito(caminhoRelativoAsset) {
  // credits usa o caminho completo do walk.png (ex "hair/buzzcut/adult/walk.png")
  const alvo = `${caminhoRelativoAsset}/walk.png`
  if (creditsByFile.has(alvo)) return creditsByFile.get(alvo)
  // fallback: qualquer entrada cujo prefixo bata com a pasta do estilo (outra animação, mesmo autor);
  // se não achar, encurta o prefixo um nível de cada vez (ex.: "facial/earrings/simple/male" ->
  // "facial/earrings/simple" -> "facial/earrings") até achar alguma entrada da mesma família.
  let prefixo = caminhoRelativoAsset
  while (prefixo.includes('/')) {
    for (const [arq, cred] of creditsByFile) {
      if (arq.startsWith(prefixo + '/')) return cred
    }
    prefixo = prefixo.slice(0, prefixo.lastIndexOf('/'))
  }
  return null
}

// ordem de preferência de variante de corpo/idade, tentada em cada pasta de estilo
const VARIANTES = ['male', 'adult', '', 'thin', 'female', 'child', 'universal']

function resolverAsset(pastaEstilo) {
  for (const v of VARIANTES) {
    const candidato = v ? join(REPO, 'spritesheets', pastaEstilo, v, 'walk.png') : join(REPO, 'spritesheets', pastaEstilo, 'walk.png')
    if (existsSync(candidato)) {
      const relativo = v ? `${pastaEstilo}/${v}` : pastaEstilo
      return { arquivo: candidato, relativo }
    }
  }
  return null
}

// mapa enum -> pasta de estilo LPC (relativa a spritesheets/), por categoria.
// null = categoria "nenhum"/sem camada (não renderiza sprite nessa opção).
const MAPA = {
  hair: {
    CARECA: null,
    RASPADO: 'hair/buzzcut',
    CURTO: 'hair/plain',
    REPARTIDO: 'hair/parted',
    CACHEADO: 'hair/curly_short',
    MOICANO: 'hair/shorthawk',
    RABO_DE_CAVALO: 'hair/ponytail/adult/fg', // ponytail é bg+fg separados; fg é a parte visível por cima
    CHIQUINHAS: 'hair/pigtails',
    LONGO: 'hair/long',
    COQUE: 'hair/half_up', // substituição: LPC não tem coque/bun dedicado, half_up é o mais próximo
    ESPETADO: 'hair/spiked',
  },
  'facial-hair': {
    NENHUM: null,
    BIGODE_FINO: 'beards/mustache/basic',
    BIGODE_GROSSO: 'beards/mustache/bigstache',
    CAVANHAQUE: 'beards/beard/trimmed',
    SUICAS: 'beards/beard/5oclock_shadow', // substituição: sem "suíças" isoladas, sombra rala é a mais próxima
    BARBA_CURTA: 'beards/beard/basic',
    BARBA_CHEIA: 'beards/beard/winter',
    CAVANHAQUE_BIGODE: 'beards/mustache/walrus', // substituição: combo mais próximo disponível
  },
  top: {
    CAMISETA: 'torso/clothes/shortsleeve/tshirt',
    REGATA: 'torso/clothes/sleeveless/sleeveless2', // tanktop só tem pasta female pré-colorida; sleeveless2 é recolorável e tem male
    POLO: 'torso/clothes/shortsleeve/shortsleeve_polo',
    CAMISA: 'torso/clothes/longsleeve/longsleeve2_buttoned',
    SUETER: 'torso/clothes/longsleeve/longsleeve2_cardigan',
    LISTRADA: 'torso/clothes/longsleeve/formal_striped',
    GOLA_V: 'torso/clothes/longsleeve/longsleeve2_vneck',
    GOLA_ALTA: 'torso/clothes/longsleeve/formal', // substituição: sem gola-alta/turtleneck, formal é a mais próxima
    MOLETOM_LEVE: 'torso/clothes/longsleeve/longsleeve2', // substituição: sem moletom leve dedicado
  },
  jacket: {
    NENHUMA: null,
    // JEANS/BLAZER/MOLETOM_CAPUZ/COLETE/CASACO_LONGO/BOMBER: pasta pré-colorida (sem arquivo único
    // recolorável) - tratadas abaixo em PREBAKED, não aqui.
    CARDIGA: 'torso/clothes/longsleeve/longsleeve2_cardigan',
    COURO: 'torso/jacket/santa', // substituição: sem jaqueta de couro dedicada, casaco fechado é o mais próximo em forma
  },
  bottom: {
    CALCA: 'legs/pants',
    JEANS: 'legs/pants',
    LEGGING: 'legs/leggings',
    SHORT: 'legs/shorts/short_shorts',
    BERMUDA: 'legs/shorts/shorts',
    SHORT_JEANS: 'legs/shorts/short_shorts',
    SAIA: 'legs/skirts/plain',
    SAIA_LONGA: 'legs/skirts/overskirt',
    CALCA_LISTRADA: 'legs/formal_striped',
  },
  shoes: {
    TENIS: 'feet/shoes/basic',
    SOCIAL: 'feet/shoes/revised',
    BOTA: 'feet/boots/basic',
    BOTA_CANO_ALTO: 'feet/boots/rimmed',
    SANDALIA: 'feet/sandals',
    CHINELO: 'feet/slippers',
    SALTO: 'feet/shoes/sara', // substituição: sem salto dedicado
    DESCALCO: null,
  },
  hat: {
    NENHUM: null,
    BONE: 'hat/cloth/leather_cap',
    BONE_LATERAL: 'hat/cloth/bandana2', // substituição: sem boné de lado dedicado
    GORRO: 'hat/cloth/hood', // substituição: sem gorro/beanie dedicado
    CHAPEU_PRAIA: 'hat/pirate/bonnie', // substituição: aba larga, mais próximo de chapéu de praia
    BANDANA: 'hat/cloth/bandana',
    FAIXA: 'hat/headband/thick',
    CARTOLA: 'hat/formal/tophat',
    CAPACETE: 'hat/helmet/norman',
    TIARA: 'hat/formal/tiara',
  },
  glasses: {
    NENHUM: null,
    REDONDO: 'facial/glasses/round',
    QUADRADO: 'facial/glasses/nerd',
    AVIADOR: 'facial/glasses/sunglasses',
    ESCUROS: 'facial/glasses/shades',
    CORACAO: 'facial/glasses/glasses', // substituição: sem formato coração, armação básica é a mais próxima
    ESTRELA: 'facial/monocle/left', // substituição: sem formato estrela, monóculo é o item "extravagante" mais próximo
    MEIA_LUA: 'facial/glasses/halfmoon',
    MASCARA_MERGULHO: 'facial/masks/plain', // substituição: sem máscara de mergulho, máscara facial genérica é a mais próxima
    TAPA_OLHO: 'facial/patches/eyepatch/ambi/adult',
  },
  other: {
    NENHUM: null,
    BRINCO: 'facial/earrings/simple',
    COLAR: 'neck/amulet/dangle',
    LENCO: 'neck/capeclip', // substituição: sem lenço de pescoço dedicado
    GRAVATA: 'neck/amulet/cross', // substituição: sem gravata dedicada
    LACO: 'neck/amulet/star', // substituição: sem laço dedicado
    BROCHE: 'facial/earrings/stud', // substituição: sem broche dedicado
    MICROFONE: null, // sem equivalente razoável no LPC - fica sem sprite (só o rótulo existe)
  },
}

mkdirSync(OUT, { recursive: true })

const substituicoes = []
const resolvidos = {}

// corpo base (Skin) - fora do loop de categorias porque não é um enum de estilo
{
  const r = resolverAsset('body/bodies/male')
  if (!r) throw new Error('corpo base não encontrado')
  const destino = join(OUT, 'skin', 'base.png')
  mkdirSync(dirname(destino), { recursive: true })
  copyFileSync(r.arquivo, destino)
  const credito = acharCredito(r.relativo)
  resolvidos['skin/base'] = { relativo: r.relativo, credito }
  console.log(`skin/base -> ${r.relativo}`)
}

for (const [categoria, mapa] of Object.entries(MAPA)) {
  for (const [enumValor, pastaEstilo] of Object.entries(mapa)) {
    if (pastaEstilo === null) { console.log(`${categoria}/${enumValor} -> (sem sprite)`); continue }
    const r = resolverAsset(pastaEstilo)
    if (!r) {
      console.warn(`!! NÃO ENCONTRADO: ${categoria}/${enumValor} (${pastaEstilo}) - pulando`)
      continue
    }
    const destino = join(OUT, categoria, `${enumValor}.png`)
    mkdirSync(dirname(destino), { recursive: true })
    copyFileSync(r.arquivo, destino)
    const credito = acharCredito(r.relativo)
    resolvidos[`${categoria}/${enumValor}`] = { relativo: r.relativo, credito }
    console.log(`${categoria}/${enumValor} -> ${r.relativo}${credito ? '' : ' (SEM crédito encontrado!)'}`)
  }
}

// --- categorias "pré-coloridas": em vez de 1 arquivo recolorável, o LPC já exporta 1 PNG pronto
// por nome de cor (walk/black.png, walk/navy.png...). Pra essas, escolho a cor de arquivo mais
// próxima de cada cor da paleta do editor (CORES_GERAL) e copio só as necessárias - sem canvas de
// recolorir em runtime, é seleção estática por nome de cor mais próxima. ---
import { readdirSync } from 'node:fs'

const CORES_GERAL = [
  '#1c1a28', '#2b2b3a', '#6b7280', '#8a5a34', '#c9a24a', '#e8a33d', '#e0546f', '#e874c4',
  '#8a4fd6', '#4472c4', '#4fa8d6', '#4f9f6f', '#2f6f45', '#c0392b', '#f2f2f2', '#ffffff',
]

// hex aproximado de cada nome de arquivo LPC usado nas pastas pré-coloridas de jaqueta/colete -
// só precisa ser bom o bastante pra escolher o arquivo mais parecido, não precisão de pixel.
const HEX_POR_NOME_LPC = {
  black: '#1a1a1a', charcoal: '#36454f', dark_gray: '#404040', gray: '#808080', slate: '#708090',
  bluegray: '#6699cc', navy: '#1a2b4a', blue: '#3457d5', sky: '#87ceeb', teal: '#008080',
  forest: '#228b22', green: '#3f7d3f', tan: '#d2b48c', brown: '#7a5230', brown_striped: '#7a5230',
  walnut: '#5c4033', leather: '#8b4513', maroon: '#6b1f2a', red: '#b3241f', rose: '#c96a6a',
  pink: '#e79bb0', purple: '#7b3f9e', lavender: '#b19cd9', lila: '#c8a2c8', orange: '#d9822b',
  yellow: '#e8c547', white: '#f2f2f2', gray_striped: '#808080', green_striped: '#3f7d3f',
}

function hexParaRgb(hex) {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function distancia(a, b) {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2
}

function corMaisProxima(nomesDisponiveis, hexAlvo) {
  const alvoRgb = hexParaRgb(hexAlvo)
  let melhor = null, melhorDist = Infinity
  for (const nome of nomesDisponiveis) {
    const hexNome = HEX_POR_NOME_LPC[nome]
    if (!hexNome) continue
    const d = distancia(alvoRgb, hexParaRgb(hexNome))
    if (d < melhorDist) { melhorDist = d; melhor = nome }
  }
  return melhor || nomesDisponiveis[0]
}

const PREBAKED = {
  JEANS: 'torso/jacket/collared/male/walk', // substituição: sem jaqueta jeans dedicada
  BLAZER: 'torso/jacket/frock/male/walk',
  MOLETOM_CAPUZ: 'torso/jacket/iverness/male/walk', // substituição: sem hoodie, capa/manto é a mais próxima em silhueta
  COLETE: 'torso/clothes/vest/male/walk',
  CASACO_LONGO: 'torso/jacket/trench/male/walk',
  BOMBER: 'torso/jacket/tabard/male/walk', // substituição: sem bomber dedicada
}

const prebakedResolvido = {}
for (const [enumValor, pastaWalk] of Object.entries(PREBAKED)) {
  const pastaAbsoluta = join(REPO, 'spritesheets', pastaWalk)
  if (!existsSync(pastaAbsoluta)) { console.warn(`!! pasta pré-colorida não existe: ${pastaWalk}`); continue }
  const arquivos = readdirSync(pastaAbsoluta).filter((f) => f.endsWith('.png'))
  const nomes = arquivos.map((f) => f.replace('.png', ''))
  const porHex = {}
  const arquivosUsados = new Set()
  for (const hex of CORES_GERAL) {
    const nomeEscolhido = corMaisProxima(nomes, hex)
    const destino = join(OUT, 'jacket', enumValor, `${nomeEscolhido}.png`)
    if (!arquivosUsados.has(nomeEscolhido)) {
      mkdirSync(dirname(destino), { recursive: true })
      copyFileSync(join(pastaAbsoluta, `${nomeEscolhido}.png`), destino)
      arquivosUsados.add(nomeEscolhido)
    }
    porHex[hex] = `${nomeEscolhido}.png`
  }
  const relativoParaCredito = pastaWalk.replace('/male/walk', '/male')
  const credito = acharCredito(relativoParaCredito)
  prebakedResolvido[`jacket/${enumValor}`] = { pastaWalk, arquivosCopiados: [...arquivosUsados], porHex, credito }
  console.log(`jacket/${enumValor} (pré-colorida) -> ${arquivosUsados.size} arquivo(s): ${[...arquivosUsados].join(', ')}`)
}

writeFileSync(join(OUT, '_manifest.json'), JSON.stringify(resolvidos, null, 2))
writeFileSync(join(OUT, '_manifest-prebaked.json'), JSON.stringify(prebakedResolvido, null, 2))
console.log('\nOK - manifests salvos em', OUT)
