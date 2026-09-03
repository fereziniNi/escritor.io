import { extend, useTick } from '@pixi/react'
import type { Container as PixiContainer, Graphics as PixiGraphics } from 'pixi.js'
import { Container, Graphics, Text } from 'pixi.js'
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import {
  desenharAnelDestaque,
  desenharAnelProximidade,
  desenharCorpoAvatar,
  desenharPerna,
  desenharSombraAvatar,
  PIVO_PERNA_DIREITA,
  PIVO_PERNA_ESQUERDA,
} from './avatarFactory'
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

/** Avatar de quem está OFFLINE (estacionado em "Fora do trabalho" pelo backend) renderiza bem
 * apagado - dá pra ver que "tem alguém ali" sem parecer alguém realmente presente/ativo. */
const ALPHA_OFFLINE = 0.45

/** Velocidade (rad/ms) e amplitude (rad) do balanço de perna enquanto anda - valores escolhidos
 * pra completar um ciclo perceptível dentro da duração de um glide (`DURACAO_GLIDE_MS`). */
const VELOCIDADE_PERNA = 0.02
const AMPLITUDE_PERNA = 0.5

/** Bob de espera (Fase 5, polish) - o corpo balança bem sutilmente mesmo parado, mesma sensação
 * da animação `escritorio-bob` que existia em CSS no mapa em DOM (1.8s por ciclo, ±2px). */
const VELOCIDADE_BOB = 0.0035
const AMPLITUDE_BOB_PX = 1.6

function hexParaNumero(cor: string): number {
  return Number(cor.replace('#', '0x'))
}

/**
 * Avatar no mundo Pixi - substitui `AvatarNoMapa`/`useAnimacaoPersonagem` (mapa em DOM). Só
 * recebe a posição em tile *confirmada* (inteira, vinda do servidor via `usePresencaWebSocket`);
 * toda a suavização visual (glide entre tiles, direção inferida do delta, balanço de perna
 * enquanto anda, bob de espera, pulso de proximidade) é interna, dirigida por `useTick`.
 *
 * Perf (pedido do usuário depois da Fase 6: "o sistema está muito lento"): antes, cada uma dessas
 * animações vivia em `useState` e chamava `setState` a cada tick (~60x/s) - até o bob de espera,
 * que roda o tempo todo mesmo parado, forçando este componente (e um avatar existe por usuário
 * online) a re-renderizar 60x/s pra sempre. A partir daqui, nada disso passa por `useState`: os
 * objetos Pixi (`Container`/`Graphics`) são mutados direto via `ref` dentro do `useTick`, sem
 * nenhum re-render do React envolvido - é o padrão correto pra animação contínua num loop de jogo
 * (o React só entra em cena pra criar os objetos uma vez; a partir daí quem move é o próprio
 * Pixi). `posicaoRenderizada`/`direcao`/`anguloPerna`/`pulsoProximidade`/`bobY` que existiam como
 * estado saíram todos - viraram mutação direta de `raizRef`/`corpoContainerRef`/`pernaRef`s/
 * `anelProximidadeRef`.
 */
export function AvatarPixi({
  tileX,
  tileY,
  nome,
  corCorpo,
  destaque,
  proximo = false,
  offline = false,
}: {
  tileX: number
  tileY: number
  nome: string
  corCorpo: string
  destaque: boolean
  /** Fase 3 - alguém está dentro do raio de proximidade deste avatar (`proximidade.ts`). */
  proximo?: boolean
  /** Backend marcou esse usuário como OFFLINE (desconectou, estacionado em "Fora do trabalho") -
   * avatar renderiza apagado + nome com sufixo, pra não parecer alguém realmente presente. */
  offline?: boolean
}) {
  const corCorpoNumero = useMemo(() => hexParaNumero(corCorpo), [corCorpo])
  const desenharCorpoMemo = useCallback((g: PixiGraphics) => desenharCorpoAvatar(g, corCorpoNumero), [corCorpoNumero])

  const raizRef = useRef<PixiContainer | null>(null)
  const corpoContainerRef = useRef<PixiContainer | null>(null)
  const pernaEsquerdaRef = useRef<PixiGraphics | null>(null)
  const pernaDireitaRef = useRef<PixiGraphics | null>(null)
  const anelProximidadeRef = useRef<PixiGraphics | null>(null)

  const alvoRef = useRef<PosicaoTile>({ x: tileX, y: tileY })
  const inicioGlideRef = useRef<PosicaoTile>({ x: tileX, y: tileY })
  const posicaoAtualRef = useRef<PosicaoTile>({ x: tileX, y: tileY })
  const progressoRef = useRef(1)
  const tempoAnimadoRef = useRef(0)
  const tempoPulsoRef = useRef(0)
  const tempoBobRef = useRef(0)
  const direcaoRef = useRef<'esquerda' | 'direita'>('direita')

  // Posição/escala/pivô iniciais só precisam ser aplicados uma vez, na montagem - depois disso
  // quem move é o `useTick` abaixo, direto nos objetos Pixi (nunca mais via prop reativa, pra não
  // ter re-render nenhum disputando com a mutação imperativa).
  useLayoutEffect(() => {
    if (raizRef.current) {
      raizRef.current.x = tileX * TILE_PX + TILE_PX / 2
      raizRef.current.y = tileY * TILE_PX + TILE_PX
    }
    if (corpoContainerRef.current) {
      corpoContainerRef.current.pivot.set(PIVO_BASE.x, PIVO_BASE.y)
      corpoContainerRef.current.scale.set(ESCALA_AVATAR, ESCALA_AVATAR)
    }
    // roda só na montagem de propósito - tileX/tileY aqui são só o valor inicial; mudanças
    // subsequentes são tratadas pelo efeito de glide logo abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useLayoutEffect(() => {
    if (alvoRef.current.x === tileX && alvoRef.current.y === tileY) {
      return
    }
    const partida = posicaoAtualRef.current
    inicioGlideRef.current = partida
    alvoRef.current = { x: tileX, y: tileY }
    progressoRef.current = 0
    if (tileX !== partida.x) {
      direcaoRef.current = tileX < partida.x ? 'esquerda' : 'direita'
      if (corpoContainerRef.current) {
        corpoContainerRef.current.scale.x = (direcaoRef.current === 'esquerda' ? -1 : 1) * ESCALA_AVATAR
      }
    }
    // posicaoAtualRef de propósito fora das deps: só nos importa o valor no momento em que
    // tileX/tileY mudam (início de um novo glide), não a cada tick que a atualiza.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileX, tileY])

  useTick((ticker) => {
    if (progressoRef.current < 1) {
      progressoRef.current = Math.min(1, progressoRef.current + ticker.deltaMS / DURACAO_GLIDE_MS)
      posicaoAtualRef.current = interpolarPosicao(inicioGlideRef.current, alvoRef.current, progressoRef.current)
      if (raizRef.current) {
        raizRef.current.x = posicaoAtualRef.current.x * TILE_PX + TILE_PX / 2
        raizRef.current.y = posicaoAtualRef.current.y * TILE_PX + TILE_PX
      }

      tempoAnimadoRef.current += ticker.deltaMS
      const angulo = Math.sin(tempoAnimadoRef.current * VELOCIDADE_PERNA) * AMPLITUDE_PERNA
      if (pernaEsquerdaRef.current) pernaEsquerdaRef.current.rotation = angulo
      if (pernaDireitaRef.current) pernaDireitaRef.current.rotation = -angulo
    } else {
      if (pernaEsquerdaRef.current && pernaEsquerdaRef.current.rotation !== 0) pernaEsquerdaRef.current.rotation = 0
      if (pernaDireitaRef.current && pernaDireitaRef.current.rotation !== 0) pernaDireitaRef.current.rotation = 0
    }

    if (proximo && anelProximidadeRef.current) {
      tempoPulsoRef.current += ticker.deltaMS
      anelProximidadeRef.current.alpha = 0.5 + Math.sin(tempoPulsoRef.current * 0.004) * 0.3
    }

    tempoBobRef.current += ticker.deltaMS
    if (corpoContainerRef.current) {
      corpoContainerRef.current.y = Math.sin(tempoBobRef.current * VELOCIDADE_BOB) * AMPLITUDE_BOB_PX
    }
  })

  return (
    <pixiContainer ref={raizRef} alpha={offline ? ALPHA_OFFLINE : 1}>
      <pixiContainer ref={corpoContainerRef}>
        <pixiGraphics draw={desenharSombraAvatar} />
        {destaque && <pixiGraphics draw={desenharAnelDestaque} />}
        {proximo && <pixiGraphics ref={anelProximidadeRef} draw={desenharAnelProximidade} />}
        <pixiGraphics draw={desenharPerna} ref={pernaEsquerdaRef} x={PIVO_PERNA_ESQUERDA.x} y={PIVO_PERNA_ESQUERDA.y} />
        <pixiGraphics draw={desenharPerna} ref={pernaDireitaRef} x={PIVO_PERNA_DIREITA.x} y={PIVO_PERNA_DIREITA.y} />
        <pixiGraphics draw={desenharCorpoMemo} />
      </pixiContainer>

      <pixiText
        text={offline ? `${nome} (offline)` : nome}
        anchor={{ x: 0.5, y: 1 }}
        y={-PIVO_BASE.y * ESCALA_AVATAR - 6}
        style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, fontWeight: '800', fill: COR_TEXTO_NOME, stroke: { color: 0x2b2b3a, width: 3 } }}
      />
    </pixiContainer>
  )
}
