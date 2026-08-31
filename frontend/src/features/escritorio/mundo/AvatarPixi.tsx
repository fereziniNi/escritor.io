import { extend, useTick } from '@pixi/react'
import { Container, Graphics, Text } from 'pixi.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import { desenharAnelDestaque, desenharAnelProximidade, desenharCorpoAvatar, desenharPerna, PIVO_PERNA_DIREITA, PIVO_PERNA_ESQUERDA } from './avatarFactory'
import { TILE_PX } from './constantes'
import { DURACAO_GLIDE_MS, interpolarPosicao } from './glide'
import type { PosicaoTile } from './movimento'

extend({ Container, Graphics, Text })

/** Escala aplicada por cima das coordenadas nativas de `PixelCharacterSvg` (viewBox 24×30) - dá
 * um personagem de ~26×33px, um pouco menor que o tile (32px) na largura, mais alto que o tile na
 * altura (a "cabeça" estica pra cima, mesma proporção "gente de pé vista de cima" do desenho
 * original em SVG). */
const ESCALA_AVATAR = 1.1

/** (x,y) local do ponto que fica ancorado na posição-mundo do avatar: base da caixa 24×30, um
 * pouco acima do fundo das pernas (27) pra "pisar" visualmente no chão em vez de flutuar. */
const PIVO_BASE = { x: 12, y: 27 }

const COR_TEXTO_NOME = 0xffffff

/** Velocidade (rad/ms) e amplitude (rad) do balanço de perna enquanto anda - valores escolhidos
 * pra completar um ciclo perceptível dentro da duração de um glide (`DURACAO_GLIDE_MS`). */
const VELOCIDADE_PERNA = 0.02
const AMPLITUDE_PERNA = 0.5

function hexParaNumero(cor: string): number {
  return Number(cor.replace('#', '0x'))
}

/**
 * Avatar no mundo Pixi - substitui `AvatarNoMapa`/`useAnimacaoPersonagem` (mapa em DOM). Só
 * recebe a posição em tile *confirmada* (inteira, vinda do servidor via `usePresencaWebSocket`);
 * toda a suavização visual (glide entre tiles, direção inferida do delta, balanço de perna
 * enquanto anda) é interna, dirigida por `useTick` - funciona porque este componente é um filho
 * de verdade dentro da árvore de `<Application>` (diferente de `CamadaMundo`, que RENDERIZA o
 * `<Application>` e por isso não pode chamar hooks de ticker diretamente, ver `SeguidorCamera`).
 */
export function AvatarPixi({
  tileX,
  tileY,
  nome,
  corCorpo,
  destaque,
  proximo = false,
}: {
  tileX: number
  tileY: number
  nome: string
  corCorpo: string
  destaque: boolean
  /** Fase 3 - alguém está dentro do raio de proximidade deste avatar (`proximidade.ts`). */
  proximo?: boolean
}) {
  const corCorpoNumero = useMemo(() => hexParaNumero(corCorpo), [corCorpo])

  const alvoRef = useRef<PosicaoTile>({ x: tileX, y: tileY })
  const inicioGlideRef = useRef<PosicaoTile>({ x: tileX, y: tileY })
  const progressoRef = useRef(1)
  const tempoAnimadoRef = useRef(0)
  const tempoPulsoRef = useRef(0)

  const [posicaoRenderizada, setPosicaoRenderizada] = useState<PosicaoTile>({ x: tileX, y: tileY })
  const [direcao, setDirecao] = useState<'esquerda' | 'direita'>('direita')
  const [anguloPerna, setAnguloPerna] = useState(0)
  const [pulsoProximidade, setPulsoProximidade] = useState(0.5)

  useEffect(() => {
    if (alvoRef.current.x === tileX && alvoRef.current.y === tileY) {
      return
    }
    const partida = posicaoRenderizada
    inicioGlideRef.current = partida
    alvoRef.current = { x: tileX, y: tileY }
    progressoRef.current = 0
    if (tileX !== partida.x) {
      setDirecao(tileX < partida.x ? 'esquerda' : 'direita')
    }
    // posicaoRenderizada de propósito fora das deps: só nos importa o valor no momento em que
    // tileX/tileY mudam (início de um novo glide), não a cada tick que a atualiza.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileX, tileY])

  useTick((ticker) => {
    if (progressoRef.current < 1) {
      progressoRef.current = Math.min(1, progressoRef.current + ticker.deltaMS / DURACAO_GLIDE_MS)
      setPosicaoRenderizada(interpolarPosicao(inicioGlideRef.current, alvoRef.current, progressoRef.current))
    }

    if (progressoRef.current < 1) {
      tempoAnimadoRef.current += ticker.deltaMS
      setAnguloPerna(Math.sin(tempoAnimadoRef.current * VELOCIDADE_PERNA) * AMPLITUDE_PERNA)
    } else if (anguloPerna !== 0) {
      setAnguloPerna(0)
    }

    if (proximo) {
      tempoPulsoRef.current += ticker.deltaMS
      setPulsoProximidade(0.5 + Math.sin(tempoPulsoRef.current * 0.004) * 0.3)
    }
  })

  const worldX = posicaoRenderizada.x * TILE_PX + TILE_PX / 2
  const worldY = posicaoRenderizada.y * TILE_PX + TILE_PX

  return (
    <pixiContainer x={worldX} y={worldY}>
      <pixiContainer pivot={PIVO_BASE} scale={{ x: direcao === 'esquerda' ? -ESCALA_AVATAR : ESCALA_AVATAR, y: ESCALA_AVATAR }}>
        {destaque && <pixiGraphics draw={desenharAnelDestaque} />}
        {proximo && <pixiGraphics draw={desenharAnelProximidade} alpha={pulsoProximidade} />}
        <pixiGraphics
          draw={desenharPerna}
          x={PIVO_PERNA_ESQUERDA.x}
          y={PIVO_PERNA_ESQUERDA.y}
          rotation={anguloPerna}
        />
        <pixiGraphics
          draw={desenharPerna}
          x={PIVO_PERNA_DIREITA.x}
          y={PIVO_PERNA_DIREITA.y}
          rotation={-anguloPerna}
        />
        <pixiGraphics draw={(g) => desenharCorpoAvatar(g, corCorpoNumero)} />
      </pixiContainer>

      <pixiText
        text={nome}
        anchor={{ x: 0.5, y: 1 }}
        y={-PIVO_BASE.y * ESCALA_AVATAR - 6}
        style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, fontWeight: '800', fill: COR_TEXTO_NOME, stroke: { color: 0x2b2b3a, width: 3 } }}
      />
    </pixiContainer>
  )
}
