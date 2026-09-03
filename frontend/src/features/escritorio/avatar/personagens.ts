/**
 * Pedido do usuário: "adicionar game-assets... sobre characteres" - substitui o sistema de
 * personalização por camadas (pele/cabelo/roupa/acessórios, tudo desenhado via `PIXI.Graphics`)
 * por sprite de verdade. Fonte: [Kenney RPG Urban Pack](https://kenney.nl/assets/rpg-urban-pack)
 * (CC0 - ver `frontend/public/personagens/LICENSE.txt`/`CREDITS.md`) - 6 personagens prontos,
 * cada um com um ciclo de caminhada de 12 quadros (só de frente - a folha não tem sprite de
 * costas/perfil separado, conferido visualmente antes de usar; direção esquerda/direita é
 * espelhada no código via `scale.x`, mesmo truque já usado no avatar desenhado à mão anterior).
 *
 * Os valores do tipo union espelham EXATAMENTE o enum Java `Personagem` (`identidade/domain/`) -
 * mesmos nomes, sem tradução na borda.
 */

import { Assets, TextureSource } from 'pixi.js'

// Sprite nativo é 16×16 e é exibido bem ampliado (`TAMANHO_SPRITE_PX` em `AvatarPixi.tsx`, ~2.9×) -
// sem isso o Pixi usa filtragem 'linear' por padrão, que borra o pixel art ao ampliar (mesma lição
// já aplicada à `<Application antialias={false}>` em `PixiMundo.tsx`, agora pro lado da textura).
// Efeito colateral do módulo, de propósito - precisa rodar antes de QUALQUER textura carregar, e
// como só existe um lugar no app que carrega texturas (os personagens), aqui já é cedo o bastante.
TextureSource.defaultOptions.scaleMode = 'nearest'

export type Personagem = 'PERSONAGEM_VERDE' | 'PERSONAGEM_VERMELHO' | 'PERSONAGEM_ROXO' | 'PERSONAGEM_CHAPEU' | 'PERSONAGEM_CINZA' | 'PERSONAGEM_BANDANA'

interface MetadataPersonagem {
  id: Personagem
  slug: string
  rotulo: string
}

export const PERSONAGENS: MetadataPersonagem[] = [
  { id: 'PERSONAGEM_VERDE', slug: 'verde', rotulo: 'Verde' },
  { id: 'PERSONAGEM_VERMELHO', slug: 'vermelho', rotulo: 'Vermelho' },
  { id: 'PERSONAGEM_ROXO', slug: 'roxo', rotulo: 'Roxo' },
  { id: 'PERSONAGEM_CHAPEU', slug: 'chapeu', rotulo: 'Chapéu' },
  { id: 'PERSONAGEM_CINZA', slug: 'cinza', rotulo: 'Cinza' },
  { id: 'PERSONAGEM_BANDANA', slug: 'bandana', rotulo: 'Bandana' },
]

const SLUG_POR_ID: Record<Personagem, string> = Object.fromEntries(PERSONAGENS.map((p) => [p.id, p.slug])) as Record<Personagem, string>

export const PERSONAGEM_PADRAO: Personagem = 'PERSONAGEM_VERDE'

export const QUADROS_POR_CICLO = 12

/** Monta o caminho pro quadro `quadro` (0-11) do ciclo de caminhada do `personagem`, servido como
 * arquivo estático (`frontend/public/personagens/`, fora do bundle do Vite - Pixi/`<img>` carregam
 * direto por URL). */
export function caminhoSprite(personagem: Personagem, quadro: number): string {
  return `/personagens/${SLUG_POR_ID[personagem]}_${quadro % QUADROS_POR_CICLO}.png`
}

/** Quadro parado (idle) - sempre o primeiro do ciclo, usado na prévia do editor e na bolha de
 * perfil (`MenuUsuario`), onde não faz sentido animar. */
export function caminhoMiniatura(personagem: Personagem): string {
  return caminhoSprite(personagem, 0)
}

/** Todos os 72 quadros (6 personagens × 12 quadros) - usado só pra pré-carregar (ver
 * `precarregarSpritesPersonagens`). */
export const TODOS_OS_CAMINHOS_DE_SPRITE: string[] = PERSONAGENS.flatMap((personagem) =>
  Array.from({ length: QUADROS_POR_CICLO }, (_, quadro) => caminhoSprite(personagem.id, quadro)),
)

/** `Texture.from(url)` (usado em `AvatarPixi.tsx`) só resolve pra textura de verdade se a URL já
 * estiver no `Cache` do Pixi - sem isso ela fica presa num placeholder 1×1 (bug encontrado na
 * verificação visual desta feature: avatar aparecia como um retângulo sólido, não o sprite).
 * Pré-carrega os 72 quadros de uma vez via `Assets.load` (que preenche o Cache) antes do mundo
 * montar qualquer avatar - chamado uma vez em `EscritorioPage`, com o resultado guardado numa
 * promise módulo-level pra não recarregar de novo em remounts. */
// TanStack Query não aceita queryFn resolvendo pra `undefined` ("Query data cannot be undefined") -
// por isso `true` em vez de `void`, mesmo o valor em si não importando pra quem chama.
let promessaDePrecarregamento: Promise<true> | null = null
export function precarregarSpritesPersonagens(): Promise<true> {
  if (!promessaDePrecarregamento) {
    promessaDePrecarregamento = Assets.load(TODOS_OS_CAMINHOS_DE_SPRITE).then(() => true as const)
  }
  return promessaDePrecarregamento
}
