import { useEffect, useMemo, useRef, useState } from 'react'
import type { WheelEvent as ReactWheelEvent } from 'react'
import { COR_STATUS } from '../icones'
import type { EstadoPresencaUsuario, Zona } from '../types'
import { AquarioAnimado } from './AquarioAnimado'
import { AvatarPixi } from './AvatarPixi'
import { calcularTransformCamera } from './camera'
import type { TransformCamera } from './camera'
import { PROXIMIDADE_RAIO_TILES, TILE_PX, ZOOM_MAXIMO, ZOOM_MINIMO, ZOOM_PADRAO } from './constantes'
import { MOBILIA_MUNDO } from './dadosMundo'
import { PixiMundo } from './PixiMundo'
import { PlantaAnimada } from './PlantaAnimada'
import { calcularParesProximos, usuariosProximosDeAlguem } from './proximidade'
import { RotuloZona } from './RotuloZona'
import { SeguidorCamera } from './SeguidorCamera'
import { desenharMobilia, desenharPiso, desenharPisoZonas } from './spriteFactory'
import { VaporAnimado } from './VaporAnimado'

/** Fase 6: `aquario`/`planta` viraram componentes animados próprios (nadam/balançam de verdade via
 * `useTick`) e saíram do lote estático que `desenharMobilia` desenha num `Graphics` só. */
const MOBILIA_ESTATICA = MOBILIA_MUNDO.filter((item) => item.tipo !== 'aquario' && item.tipo !== 'planta')
const ITENS_AQUARIO = MOBILIA_MUNDO.filter((item) => item.tipo === 'aquario')
const ITENS_PLANTA = MOBILIA_MUNDO.filter((item) => item.tipo === 'planta')
/** Vapor sobe só por cima da cafeteira (não do balcão genérico - "balcao" aparece em salas sem
 * relação com café também, ex. recepção futura). */
const ITENS_CAFETEIRA = MOBILIA_MUNDO.filter((item) => item.tipo === 'cafeteira')

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
 * Compõe o mundo Pixi: piso + móveis + avatares, com uma câmera que segue o próprio jogador
 * (suavizada por `SeguidorCamera`) - roda do mouse ainda ajusta o zoom. Sem paredes de propósito
 * (pedido do usuário: "remover as paredes, deixar o mapa mais vivo") - as 4 salas continuam
 * distinguíveis por terem material/cor de piso própria (`desenharPisoZonas`, Fase 6) e pela
 * densidade de móveis de cada uma, sem barreira física nem colisão entre elas.
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
  const proximos = useMemo(
    () => usuariosProximosDeAlguem(calcularParesProximos(usuarios, PROXIMIDADE_RAIO_TILES)),
    [usuarios],
  )

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
          <pixiGraphics draw={(g) => desenharPisoZonas(g, zonas)} />
          <pixiGraphics draw={(g) => desenharMobilia(g, MOBILIA_ESTATICA)} />
          {ITENS_AQUARIO.map((item, indice) => (
            <AquarioAnimado key={`aquario-${indice}`} tileX={item.x} tileY={item.y} />
          ))}
          {ITENS_PLANTA.map((item, indice) => (
            <PlantaAnimada key={`planta-${indice}`} tileX={item.x} tileY={item.y} />
          ))}
          {ITENS_CAFETEIRA.map((item, indice) => (
            <VaporAnimado key={`vapor-${indice}`} tileX={item.x} tileY={item.y} />
          ))}
          {zonas.map((zona) => (
            <RotuloZona key={zona.id} zona={zona} />
          ))}
          {usuarios.map((usuario) => (
            <AvatarPixi
              key={usuario.usuarioId}
              tileX={usuario.x}
              tileY={usuario.y}
              nome={usuario.nome}
              corCorpo={COR_STATUS[usuario.status]}
              destaque={usuario.usuarioId === meuUsuarioId}
              proximo={proximos.has(usuario.usuarioId)}
              offline={usuario.status === 'OFFLINE'}
            />
          ))}
        </pixiContainer>
      </PixiMundo>
    </div>
  )
}
