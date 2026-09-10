import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { WheelEvent as ReactWheelEvent } from 'react'
import { COR_STATUS } from '../icones'
import type { EstadoPresencaUsuario, Zona } from '../types'
import { AquarioAnimado } from './AquarioAnimado'
import { AvatarPixi } from './AvatarPixi'
import { calcularTransformCamera } from './camera'
import type { TransformCamera } from './camera'
import { cabineTemAlguemDentro } from './construirBloqueioDeCapacidade'
import { PROXIMIDADE_RAIO_TILES, TILE_PX, ZOOM_MAXIMO, ZOOM_MINIMO, ZOOM_PADRAO } from './constantes'
import { BORDA_PORTA_POR_TIPO, MOBILIA_MUNDO } from './dadosMundo'
import { gerarParedesDeZona } from './gerarParedesDeZona'
import { PixiMundo } from './PixiMundo'
import { PlantaAnimada } from './PlantaAnimada'
import { calcularParesProximos, usuariosProximosDeAlguem } from './proximidade'
import { SeguidorCamera } from './SeguidorCamera'
import { desenharMobilia, desenharParedes, desenharPiso, desenharPisoZonas } from './spriteFactory'
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
 * (suavizada por `SeguidorCamera`) - roda do mouse ainda ajusta o zoom. Paredes de verdade em toda
 * sala (pedido do usuário: "coloque parede em todas [as áreas]" - decisão anterior de mapa aberto,
 * "remover as paredes, deixar o mapa mais vivo", foi revertida por completo): cada zona ganha
 * parede de perímetro com uma única porta, a borda escolhida por tipo (`BORDA_PORTA_POR_TIPO` em
 * `dadosMundo.ts`) - mesma fonte de paredes que `EscritorioPage.tsx` usa pra bloquear o movimento
 * de verdade (`desenharParedes`/`gerarParedesDeZona`). Uma cabine ocupada perde a porta no desenho
 * também - pedido do usuário: "quando a sala estiver fechada para uma pessoa, deve fechar
 * visualmente também", depois "fechar pra quem entra também" (`cabineTemAlguemDentro`, igual pra
 * todo mundo incluindo o próprio ocupante - diferente de `cabineEstaCheia`, que só o bloqueio de
 * movimento usa). Sem rótulo de nome flutuando sobre
 * a sala (pedido do usuário: "remova os nomes das áreas" - `RotuloZona.tsx` foi removido por
 * completo).
 */
export function CamadaMundo({
  larguraTiles,
  alturaTiles,
  zonas,
  usuarios,
  meuUsuarioId,
  falando,
}: {
  larguraTiles: number
  alturaTiles: number
  zonas: Zona[]
  usuarios: EstadoPresencaUsuario[]
  meuUsuarioId: number | null
  /** Pedido do usuário: "voice" - ids de quem está com a voz ativa agora (`useVozProximidade.ts`). */
  falando?: Set<number>
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

  // `transform` muda a cada tick (câmera seguindo o jogador, ver `SeguidorCamera`), o que
  // re-renderiza este componente ~60x/s - sem memoizar essas 3 funções `draw`, o `@pixi/react`
  // redesenharia piso+zonas+móveis (dezenas de itens, cada um com sombra/destaque desde a Fase 6)
  // do zero a cada tick, mesmo esses itens nunca mudando. Causa real do "sistema travando" reportado
  // depois da Fase 6 - o piso/mobília não precisam ser redesenhados, só a `pixiContainer` pai
  // precisa mover (isso continua barato, é só um transform).
  const desenharPisoMemo = useCallback((g: import('pixi.js').Graphics) => desenharPiso(g, larguraTiles, alturaTiles), [larguraTiles, alturaTiles])
  const desenharPisoZonasMemo = useCallback((g: import('pixi.js').Graphics) => desenharPisoZonas(g, zonas), [zonas])
  // Pedido do usuário: "quando a sala estiver fechada para uma pessoa, deve fechar visualmente
  // também" - depois: "o usuário que entrou... a porta fica aberta [pra ele], mas os outros veem
  // fechada. Tem como fechar pra quem entra também?" - `cabineTemAlguemDentro` (diferente de
  // `cabineEstaCheia`, usada só pro bloqueio de movimento) não exclui "eu mesmo": uma cabine
  // ocupada perde a porta no desenho pra QUALQUER UM que olhar, o próprio ocupante incluso. A
  // borda vira `null`, que `gerarParedesDeZona` fecha por completo, sem vão nenhum.
  const paredes = useMemo(
    () =>
      gerarParedesDeZona(zonas, (zona) =>
        zona.tipo === 'CABINE' && cabineTemAlguemDentro(zona, usuarios) ? null : BORDA_PORTA_POR_TIPO[zona.tipo],
      ),
    [zonas, usuarios],
  )
  const desenharParedesMemo = useCallback((g: import('pixi.js').Graphics) => desenharParedes(g, paredes), [paredes])
  const desenharMobiliaMemo = useCallback((g: import('pixi.js').Graphics) => desenharMobilia(g, MOBILIA_ESTATICA), [])

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
          <pixiGraphics draw={desenharPisoMemo} />
          <pixiGraphics draw={desenharPisoZonasMemo} />
          <pixiGraphics draw={desenharParedesMemo} />
          <pixiGraphics draw={desenharMobiliaMemo} />
          {ITENS_AQUARIO.map((item, indice) => (
            <AquarioAnimado key={`aquario-${indice}`} tileX={item.x} tileY={item.y} />
          ))}
          {ITENS_PLANTA.map((item, indice) => (
            <PlantaAnimada key={`planta-${indice}`} tileX={item.x} tileY={item.y} />
          ))}
          {ITENS_CAFETEIRA.map((item, indice) => (
            <VaporAnimado key={`vapor-${indice}`} tileX={item.x} tileY={item.y} />
          ))}
          {usuarios.map((usuario) => (
            <AvatarPixi
              key={usuario.usuarioId}
              tileX={usuario.x}
              tileY={usuario.y}
              nome={usuario.nome}
              aparencia={usuario.aparencia}
              status={COR_STATUS[usuario.status]}
              destaque={usuario.usuarioId === meuUsuarioId}
              proximo={proximos.has(usuario.usuarioId)}
              falando={falando?.has(usuario.usuarioId) ?? false}
              offline={usuario.status === 'OFFLINE'}
            />
          ))}
        </pixiContainer>
      </PixiMundo>
    </div>
  )
}
