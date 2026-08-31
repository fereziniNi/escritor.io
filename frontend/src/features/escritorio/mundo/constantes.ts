/**
 * Tile fixo em pixels do mundo Pixi - substitui `useDimensaoTileResponsiva` (esticava X/Y de forma
 * não-uniforme pra caber na tela, o oposto de "grid consistente"). Com um tile fixo, é a câmera
 * (pan/zoom/follow) que resolve caber em qualquer viewport, não o tile mudando de tamanho.
 */
export const TILE_PX = 32

/** Raio de proximidade em tiles (distância euclidiana) - usado pelo destaque visual de "perto um do
 * outro", não uma constante mágica espalhada pelo código. */
export const PROXIMIDADE_RAIO_TILES = 2
