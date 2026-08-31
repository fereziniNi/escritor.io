/**
 * Tile fixo em pixels do mundo Pixi - substitui `useDimensaoTileResponsiva` (esticava X/Y de forma
 * não-uniforme pra caber na tela, o oposto de "grid consistente"). Com um tile fixo, é a câmera
 * (pan/zoom/follow) que resolve caber em qualquer viewport, não o tile mudando de tamanho.
 */
export const TILE_PX = 32

/** Raio de proximidade em tiles (distância euclidiana) - usado pelo destaque visual de "perto um do
 * outro", não uma constante mágica espalhada pelo código. */
export const PROXIMIDADE_RAIO_TILES = 2

export const ZOOM_MINIMO = 0.6
export const ZOOM_MAXIMO = 2.5
/**
 * Em zoom 1.0 o mapa (20×15 tiles × 32px = 640×480px) fica bem menor que a viewport na maioria
 * das telas - a câmera então só centraliza o mapinha inteiro no meio de uma área vazia enorme, e
 * o avatar (~26×33px) vira um detalhe minúsculo fácil de perder de vista (reportado pelo usuário:
 * "não achei" o boneco). 1.8 põe o mapa numa escala parecida com a que o mapa em DOM tinha por
 * padrão (tile efetivo de 32*1.8≈58px, perto dos 40-72px que o tile em DOM ocupava) - com isso o
 * mundo passa a ser maior que a viewport na maioria das telas de verdade, que é o que "mundo maior
 * que a viewport" pedia desde o começo, em vez de só valer em telas pequenas.
 */
export const ZOOM_PADRAO = 1.8
