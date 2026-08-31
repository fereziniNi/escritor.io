import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react'
import type { Zona } from '../types'
import { calcularTransformCamera } from './camera'
import { TILE_PX, ZOOM_MAXIMO, ZOOM_MINIMO, ZOOM_PADRAO } from './constantes'
import { MOBILIA_MUNDO, PORTAS_OVERRIDE } from './dadosMundo'
import { gerarParedesDeZona } from './gerarParedesDeZona'
import { PixiMundo } from './PixiMundo'
import { desenharMobilia, desenharParedes, desenharPiso } from './spriteFactory'

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
 * Compõe o mundo Pixi: piso + móveis + paredes, com uma câmera navegável (roda do mouse pra zoom,
 * arrastar pra fazer pan) centralizada por padrão no meio do mapa - o "seguir o avatar" entra na
 * Fase 2 junto com o movimento de verdade (`useCameraFollow`, ainda não escrito). Ainda não é
 * montado dentro do `EscritorioPage.tsx` real (o mapa em DOM continua sendo o que os usuários
 * veem) até a Fase 2 ter paridade de funcionalidade - ver plano.
 */
export function CamadaMundo({
  larguraTiles,
  alturaTiles,
  zonas,
}: {
  larguraTiles: number
  alturaTiles: number
  zonas: Zona[]
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewport = useTamanhoViewport(hostRef)
  const paredes = useMemo(() => gerarParedesDeZona(zonas, PORTAS_OVERRIDE), [zonas])

  const larguraMundoPx = larguraTiles * TILE_PX
  const alturaMundoPx = alturaTiles * TILE_PX

  const [zoom, setZoom] = useState(ZOOM_PADRAO)
  const [centro, setCentro] = useState(() => ({ x: larguraMundoPx / 2, y: alturaMundoPx / 2 }))
  const arrastoRef = useRef<{ x: number; y: number } | null>(null)

  function aoRodarRoda(evento: ReactWheelEvent<HTMLDivElement>) {
    setZoom((atual) => Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, atual - evento.deltaY * 0.001)))
  }

  function aoPressionarPonteiro(evento: ReactPointerEvent<HTMLDivElement>) {
    arrastoRef.current = { x: evento.clientX, y: evento.clientY }
  }

  function aoMoverPonteiro(evento: ReactPointerEvent<HTMLDivElement>) {
    if (!arrastoRef.current) return
    const dx = evento.clientX - arrastoRef.current.x
    const dy = evento.clientY - arrastoRef.current.y
    arrastoRef.current = { x: evento.clientX, y: evento.clientY }
    setCentro((atual) => ({ x: atual.x - dx / zoom, y: atual.y - dy / zoom }))
  }

  function aoSoltarPonteiro() {
    arrastoRef.current = null
  }

  const transform = calcularTransformCamera({
    jogadorX: centro.x,
    jogadorY: centro.y,
    larguraMundoPx,
    alturaMundoPx,
    larguraViewportPx: viewport.largura,
    alturaViewportPx: viewport.altura,
    zoom,
  })

  return (
    <div
      ref={hostRef}
      data-testid="mundo-viewport"
      style={{ width: '100%', height: '100%', cursor: arrastoRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}
      onWheel={aoRodarRoda}
      onPointerDown={aoPressionarPonteiro}
      onPointerMove={aoMoverPonteiro}
      onPointerUp={aoSoltarPonteiro}
      onPointerLeave={aoSoltarPonteiro}
    >
      <PixiMundo>
        <pixiContainer x={transform.x} y={transform.y} scale={transform.scale}>
          <pixiGraphics draw={(g) => desenharPiso(g, larguraTiles, alturaTiles)} />
          <pixiGraphics draw={(g) => desenharMobilia(g, MOBILIA_MUNDO)} />
          <pixiGraphics draw={(g) => desenharParedes(g, paredes)} />
        </pixiContainer>
      </PixiMundo>
    </div>
  )
}
