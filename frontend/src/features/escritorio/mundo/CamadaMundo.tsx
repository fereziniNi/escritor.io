import { useEffect, useMemo, useRef, useState } from 'react'
import type { WheelEvent as ReactWheelEvent } from 'react'
import { COR_STATUS } from '../icones'
import type { EstadoPresencaUsuario, Zona } from '../types'
import { AvatarPixi } from './AvatarPixi'
import { calcularTransformCamera } from './camera'
import type { TransformCamera } from './camera'
import { TILE_PX, ZOOM_MAXIMO, ZOOM_MINIMO, ZOOM_PADRAO } from './constantes'
import { MOBILIA_MUNDO, PORTAS_OVERRIDE } from './dadosMundo'
import { gerarParedesDeZona } from './gerarParedesDeZona'
import { PixiMundo } from './PixiMundo'
import { SeguidorCamera } from './SeguidorCamera'
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
 * Compõe o mundo Pixi: piso + móveis + paredes + avatares, com uma câmera que segue o próprio
 * jogador (suavizada por `SeguidorCamera`) - roda do mouse ainda ajusta o zoom. Sem jogador
 * localizável ainda (antes do snapshot inicial do WebSocket chegar) a câmera fica centralizada no
 * mapa, mesmo comportamento estático da Fase 1. Ainda não é montado dentro do
 * `EscritorioPage.tsx` real (o mapa em DOM continua sendo o que os usuários veem) até o movimento
 * de teclado ter paridade (Fase 2.2) - ver plano.
 */
export function CamadaMundo({
  larguraTiles,
  alturaTiles,
  zonas,
  usuarios,
  meuUsuarioId,
}: {
  larguraTiles: number
  alturaTiles: number
  zonas: Zona[]
  usuarios: EstadoPresencaUsuario[]
  meuUsuarioId: number | null
}) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewport = useTamanhoViewport(hostRef)
  const paredes = useMemo(() => gerarParedesDeZona(zonas, PORTAS_OVERRIDE), [zonas])

  const larguraMundoPx = larguraTiles * TILE_PX
  const alturaMundoPx = alturaTiles * TILE_PX

  const [zoom, setZoom] = useState(ZOOM_PADRAO)
  const [transform, setTransform] = useState<TransformCamera>(() =>
    calcularTransformCamera({
      jogadorX: larguraMundoPx / 2,
      jogadorY: alturaMundoPx / 2,
      larguraMundoPx,
      alturaMundoPx,
      larguraViewportPx: VIEWPORT_PADRAO_PX.largura,
      alturaViewportPx: VIEWPORT_PADRAO_PX.altura,
      zoom: ZOOM_PADRAO,
    }),
  )

  function aoRodarRoda(evento: ReactWheelEvent<HTMLDivElement>) {
    setZoom((atual) => Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, atual - evento.deltaY * 0.001)))
  }

  const eu = meuUsuarioId !== null ? usuarios.find((u) => u.usuarioId === meuUsuarioId) : undefined
  const alvoX = eu ? eu.x * TILE_PX + TILE_PX / 2 : larguraMundoPx / 2
  const alvoY = eu ? eu.y * TILE_PX + TILE_PX / 2 : alturaMundoPx / 2

  return (
    <div
      ref={hostRef}
      data-testid="mundo-viewport"
      style={{ width: '100%', height: '100%' }}
      onWheel={aoRodarRoda}
    >
      <PixiMundo>
        <SeguidorCamera
          alvoX={alvoX}
          alvoY={alvoY}
          larguraMundoPx={larguraMundoPx}
          alturaMundoPx={alturaMundoPx}
          larguraViewportPx={viewport.largura}
          alturaViewportPx={viewport.altura}
          zoom={zoom}
          transformAtual={transform}
          aoAtualizar={setTransform}
        />
        <pixiContainer x={transform.x} y={transform.y} scale={transform.scale}>
          <pixiGraphics draw={(g) => desenharPiso(g, larguraTiles, alturaTiles)} />
          <pixiGraphics draw={(g) => desenharMobilia(g, MOBILIA_MUNDO)} />
          <pixiGraphics draw={(g) => desenharParedes(g, paredes)} />
          {usuarios.map((usuario) => (
            <AvatarPixi
              key={usuario.usuarioId}
              tileX={usuario.x}
              tileY={usuario.y}
              nome={usuario.nome}
              corCorpo={COR_STATUS[usuario.status]}
              direcao="direita"
              destaque={usuario.usuarioId === meuUsuarioId}
            />
          ))}
        </pixiContainer>
      </PixiMundo>
    </div>
  )
}
