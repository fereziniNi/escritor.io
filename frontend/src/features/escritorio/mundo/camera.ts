export interface TransformCamera {
  x: number
  y: number
  scale: number
}

interface ParametrosCamera {
  /** posição do jogador no mundo, em px (não em tiles) */
  jogadorX: number
  jogadorY: number
  larguraMundoPx: number
  alturaMundoPx: number
  larguraViewportPx: number
  alturaViewportPx: number
  zoom: number
}

/**
 * Calcula o offset (x,y) a aplicar no container-mundo pra centralizar a câmera no jogador, com
 * *clamp* pra nunca mostrar além da borda do mundo. Quando o mundo (escalado pelo zoom) é menor
 * que a viewport num eixo, centraliza o mundo nesse eixo em vez de tentar seguir o jogador (não
 * dá pra "seguir" sem sobra quando não há por onde a câmera se mover).
 */
export function calcularTransformCamera(params: ParametrosCamera): TransformCamera {
  const { jogadorX, jogadorY, larguraMundoPx, alturaMundoPx, larguraViewportPx, alturaViewportPx, zoom } = params

  return {
    x: calcularEixo(jogadorX, larguraMundoPx, larguraViewportPx, zoom),
    y: calcularEixo(jogadorY, alturaMundoPx, alturaViewportPx, zoom),
    scale: zoom,
  }
}

function calcularEixo(jogadorPx: number, mundoPx: number, viewportPx: number, zoom: number): number {
  const mundoEscalado = mundoPx * zoom
  if (mundoEscalado <= viewportPx) {
    return (viewportPx - mundoEscalado) / 2
  }
  const alvo = viewportPx / 2 - jogadorPx * zoom
  const minimo = viewportPx - mundoEscalado
  const maximo = 0
  return Math.min(maximo, Math.max(minimo, alvo))
}

/**
 * Suavização exponencial por tick: aproxima `atual` de `alvo` por uma fração `fatorSuavizacao`
 * a cada chamada (assume ser chamado uma vez por tick do Pixi `Ticker`, ~60fps por padrão) - dá o
 * efeito de câmera "seguindo com atraso" em vez de um snap duro na posição do jogador.
 */
export function suavizarCamera(atual: TransformCamera, alvo: TransformCamera, fatorSuavizacao: number): TransformCamera {
  return {
    x: atual.x + (alvo.x - atual.x) * fatorSuavizacao,
    y: atual.y + (alvo.y - atual.y) * fatorSuavizacao,
    scale: atual.scale + (alvo.scale - atual.scale) * fatorSuavizacao,
  }
}
