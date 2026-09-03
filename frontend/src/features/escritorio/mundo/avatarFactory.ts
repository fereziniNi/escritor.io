import type { Graphics as PixiGraphics } from 'pixi.js'

/**
 * Overlays do avatar (sombra/anéis/indicador de status) - o corpo em si NÃO é mais desenhado
 * aqui desde a troca pra sprite de verdade (pedido do usuário: "adicionar game-assets... sobre
 * characteres", ver `avatar/personagens.ts` - Kenney RPG Urban Pack, CC0). Essas 4 funções
 * continuam via `PIXI.Graphics` (formas simples, nada que precise de um sprite) e usam a mesma
 * "grade virtual" 24×30 que o avatar desenhado à mão antigo usava, pro sprite (16×16 nativo)
 * encaixar no mesmo lugar sem precisar recalcular a posição de sombra/anéis/nome.
 */

const COR_DESTAQUE = 0xf2a541
/** Azul-ciano de propósito bem distante do laranja de "sou eu" (`COR_DESTAQUE`) - os dois anéis
 * podem aparecer ao mesmo tempo (sou eu E estou perto de alguém) e precisam ser distinguíveis. */
const COR_PROXIMIDADE = 0x4fc3f2

/** Sombra sob o avatar (Fase 6, pedido "tudo muito chapado/sem sombra") - elipse escura no chão,
 * desenhada num `Graphics` próprio, primeiro filho de `AvatarPixi` (antes do sprite), pra ficar
 * visualmente "atrás" do personagem mesmo sem ordenação de profundidade de verdade. */
export function desenharSombraAvatar(g: PixiGraphics): void {
  g.clear()
  g.ellipse(12, 27, 8, 3.2)
  g.fill({ color: 0x000000, alpha: 0.22 })
}

/** Pontinho colorido num canto fixo do avatar - o sinal de status (era a cor da roupa na versão
 * desenhada à mão; o sprite pronto não tem como recolorir só a roupa, então virou um indicador à
 * parte). Mesma paleta de sempre (`COR_STATUS`), só um lugar novo pra aparecer. */
export function desenharIndicadorStatus(g: PixiGraphics, corStatus: number): void {
  g.clear()
  g.circle(19.3, 25.3, 2.4)
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
