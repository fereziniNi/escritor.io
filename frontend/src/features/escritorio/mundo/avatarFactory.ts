import type { Graphics as PixiGraphics } from 'pixi.js'

/**
 * Overlays do avatar (sombra/anéis/indicador de status) - o corpo em si NÃO é mais desenhado
 * aqui desde a troca pra sprite de verdade (pedido do usuário: "adicionar game-assets... sobre
 * characteres", ver `avatar/personagens.ts` - Kenney RPG Urban Pack, CC0). Essas 4 funções
 * continuam via `PIXI.Graphics` (formas simples, nada que precise de um sprite).
 *
 * `CHAO_Y` é o nível dos pés - o mesmo ponto (0,0 em `raizRef`, ver `AvatarPixi.tsx`) em que o
 * sprite fica ancorado (`anchor={{x:0.5,y:1}}`), então sombra/indicador ficam sempre "no chão"
 * independente do tamanho do sprite. Os anéis (destaque/proximidade) já precisam saber o tamanho
 * do sprite pra continuar envolvendo o corpo inteiro em vez de só os pés - por isso recebem
 * `tamanhoSprite` como parâmetro (pedido do usuário depois de achar o personagem "muito pequeno":
 * aumentar `TAMANHO_SPRITE_PX` não pode deixar os anéis pra trás, cobrindo só metade do corpo).
 */

const CHAO_Y = 27

const COR_DESTAQUE = 0xf2a541
/** Azul-ciano de propósito bem distante do laranja de "sou eu" (`COR_DESTAQUE`) - os dois anéis
 * podem aparecer ao mesmo tempo (sou eu E estou perto de alguém) e precisam ser distinguíveis. */
const COR_PROXIMIDADE = 0x4fc3f2

/** Sombra sob o avatar (Fase 6, pedido "tudo muito chapado/sem sombra") - elipse escura no chão,
 * desenhada num `Graphics` próprio, primeiro filho de `AvatarPixi` (antes do sprite), pra ficar
 * visualmente "atrás" do personagem mesmo sem ordenação de profundidade de verdade. Tamanho fixo
 * de propósito (é a pegada no chão, não o corpo - não cresce junto com a altura do sprite). */
export function desenharSombraAvatar(g: PixiGraphics): void {
  g.clear()
  g.ellipse(12, CHAO_Y, 8, 3.2)
  g.fill({ color: 0x000000, alpha: 0.22 })
}

/** Pontinho colorido num canto fixo do avatar - o sinal de status (era a cor da roupa na versão
 * desenhada à mão; o sprite pronto não tem como recolorir só a roupa, então virou um indicador à
 * parte). Mesma paleta de sempre (`COR_STATUS`), só um lugar novo pra aparecer. */
export function desenharIndicadorStatus(g: PixiGraphics, corStatus: number): void {
  g.clear()
  g.circle(19.3, CHAO_Y - 1.7, 2.4)
  g.fill({ color: corStatus })
  g.stroke({ width: 1.2, color: 0xffffff })
}

export function desenharAnelDestaque(g: PixiGraphics, tamanhoSprite: number): void {
  g.clear()
  g.circle(12, CHAO_Y - tamanhoSprite / 2, tamanhoSprite / 2 + 3)
  g.stroke({ width: 2, color: COR_DESTAQUE, alpha: 0.9 })
}

/** Anel maior que o de destaque (fica por fora dele quando os dois aparecem juntos) - a
 * pulsação (alpha) é controlada por quem desenha via a prop `alpha` do `<pixiGraphics>`, não aqui. */
export function desenharAnelProximidade(g: PixiGraphics, tamanhoSprite: number): void {
  g.clear()
  g.circle(12, CHAO_Y - tamanhoSprite / 2, tamanhoSprite / 2 + 8)
  g.stroke({ width: 2.5, color: COR_PROXIMIDADE })
}
