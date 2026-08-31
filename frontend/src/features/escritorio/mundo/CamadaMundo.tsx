import { useEffect, useRef, useState } from 'react'
import { calcularTransformCamera } from './camera'
import { TILE_PX } from './constantes'
import { PixiMundo } from './PixiMundo'
import { desenharPiso } from './spriteFactory'

/** Valor de fallback determinístico quando não há `ResizeObserver` de verdade disponível (mesmo
 * espírito do fallback que `useDimensaoTileResponsiva` usava no mapa em DOM). */
const VIEWPORT_PADRAO_PX = { largura: 960, altura: 600 }

function useTamanhoViewport(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [tamanho, setTamanho] = useState(VIEWPORT_PADRAO_PX)

  useEffect(() => {
    const elemento = containerRef.current
    if (!elemento || typeof ResizeObserver === 'undefined') {
      return undefined
    }
    const observer = new ResizeObserver((entradas) => {
      const entrada = entradas[0]
      if (!entrada) return
      const { width, height } = entrada.contentRect
      if (width <= 0 || height <= 0) return
      setTamanho({ largura: width, altura: height })
    })
    observer.observe(elemento)
    return () => observer.disconnect()
  }, [containerRef])

  return tamanho
}

/**
 * Compõe o mundo Pixi: por enquanto (Fase 1.1 do redesign Gather) só o piso, com uma câmera
 * estática centralizada no meio do mapa - paredes/móveis/avatares/follow entram nas próximas
 * etapas. Ainda não é montado dentro do `EscritorioPage.tsx` real (o mapa em DOM continua sendo o
 * que os usuários veem) até a Fase 2 ter paridade de funcionalidade (movimento incluso) - ver
 * plano.
 */
export function CamadaMundo({ larguraTiles, alturaTiles }: { larguraTiles: number; alturaTiles: number }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewport = useTamanhoViewport(hostRef)

  const larguraMundoPx = larguraTiles * TILE_PX
  const alturaMundoPx = alturaTiles * TILE_PX

  const transform = calcularTransformCamera({
    jogadorX: larguraMundoPx / 2,
    jogadorY: alturaMundoPx / 2,
    larguraMundoPx,
    alturaMundoPx,
    larguraViewportPx: viewport.largura,
    alturaViewportPx: viewport.altura,
    zoom: 1,
  })

  return (
    <div ref={hostRef} data-testid="mundo-viewport" style={{ width: '100%', height: '100%' }}>
      <PixiMundo>
        <pixiContainer x={transform.x} y={transform.y} scale={transform.scale}>
          <pixiGraphics draw={(g) => desenharPiso(g, larguraTiles, alturaTiles)} />
        </pixiContainer>
      </PixiMundo>
    </div>
  )
}
