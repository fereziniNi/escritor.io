import { extend, useTick } from '@pixi/react'
import type { Container as PixiContainer, Graphics as PixiGraphics, Sprite as PixiSprite } from 'pixi.js'
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import { useLayoutEffect, useMemo, useRef } from 'react'
import { caminhoSprite, QUADROS_POR_CICLO, type Personagem } from '../avatar/personagens'
import { desenharAnelDestaque, desenharAnelProximidade, desenharIndicadorStatus, desenharSombraAvatar } from './avatarFactory'
import { TILE_PX } from './constantes'
import { DURACAO_GLIDE_MS, interpolarPosicao } from './glide'
import type { PosicaoTile } from './movimento'

extend({ Container, Graphics, Sprite, Text })

/** Tamanho do sprite exibido (nativo é 16×16) - um pouco maior que o tile (32px), mesmo espírito
 * de `ESCALA_AVATAR` da versão desenhada à mão anterior (avatar levemente maior que o chão embaixo
 * dele, pra não ficar minúsculo). */
const TAMANHO_SPRITE_PX = 22

/** Troca a textura do sprite E reafirma o tamanho exibido a partir dela. `Texture.from(url)` só
 * resolve pra textura de verdade se a URL já estiver no `Cache` do Pixi (preenchido antecipadamente
 * por `precarregarSpritesPersonagens`, chamado em `EscritorioPage`) - sem isso ela fica presa num
 * placeholder 1×1, e como `width`/`height` (JSX) calculam a escala a partir do tamanho da textura
 * *no momento em que são aplicados*, ficar só nesses props não corrige a escala se a textura mudar
 * depois (foi exatamente o bug visto na checagem visual desta feature: avatar virava um retângulo
 * esticado). Reaplicar `width`/`height` toda vez que a textura troca evita essa dessincronia,
 * mesmo se por algum motivo a textura ainda não estiver pronta. */
function aplicarQuadro(sprite: PixiSprite, personagem: Personagem, quadro: number) {
  sprite.texture = Texture.from(caminhoSprite(personagem, quadro))
  sprite.width = TAMANHO_SPRITE_PX
  sprite.height = TAMANHO_SPRITE_PX
}

/** (x,y) local do ponto que fica ancorado na posição-mundo do avatar - mesma "grade virtual" 24×30
 * que a versão desenhada à mão usava (ver `avatarFactory.ts`), só a base dos pés muda de menos
 * pixels pro sprite pronto (16×16) caber puxado pro chão em vez de flutuar. */
const PIVO_BASE = { x: 12, y: 27 }

const COR_TEXTO_NOME = 0xffffff

/** Avatar de quem está OFFLINE (estacionado em "Fora do trabalho" pelo backend) renderiza bem
 * apagado - dá pra ver que "tem alguém ali" sem parecer alguém realmente presente/ativo. */
const ALPHA_OFFLINE = 0.45

/** Duração de cada quadro do ciclo de caminhada (12 quadros × 70ms ≈ 840ms por volta completa) -
 * só avança enquanto o avatar está de fato andando (glide em progresso), parado fica sempre no
 * quadro 0 (idle). */
const DURACAO_QUADRO_MS = 70

/** Bob de espera (Fase 5, polish, ainda vale pro sprite) - o corpo balança bem sutilmente mesmo
 * parado, mesma sensação de antes. */
const VELOCIDADE_BOB = 0.0035
const AMPLITUDE_BOB_PX = 1.6

/**
 * Avatar no mundo Pixi - substitui `AvatarNoMapa`/`useAnimacaoPersonagem` (mapa em DOM) e, mais
 * recentemente, o corpo desenhado à mão via `PIXI.Graphics` por um sprite de verdade (pedido do
 * usuário: "adicionar game-assets... sobre characteres", ver `avatar/personagens.ts`). Só recebe a
 * posição em tile *confirmada* (inteira, vinda do servidor via `usePresencaWebSocket`); toda a
 * suavização visual (glide entre tiles, direção inferida do delta, quadro de caminhada, bob de
 * espera, pulso de proximidade) é interna, dirigida por `useTick`.
 *
 * Perf (lição das duas rodadas de correção desta sessão): nada aqui passa por `useState` - os
 * objetos Pixi (`Container`/`Sprite`/`Graphics`) são mutados direto via `ref` dentro do `useTick`,
 * sem nenhum re-render do React envolvido.
 */
export function AvatarPixi({
  tileX,
  tileY,
  nome,
  personagem,
  status,
  destaque,
  proximo = false,
  offline = false,
}: {
  tileX: number
  tileY: number
  nome: string
  personagem: Personagem
  /** Cor do status (`COR_STATUS[status]`) - vira o pontinho indicador (o sprite pronto não tem
   * como recolorir só a roupa igual o avatar desenhado à mão tinha). */
  status: string
  destaque: boolean
  /** Fase 3 - alguém está dentro do raio de proximidade deste avatar (`proximidade.ts`). */
  proximo?: boolean
  /** Backend marcou esse usuário como OFFLINE (desconectou, estacionado em "Fora do trabalho") -
   * avatar renderiza apagado + nome com sufixo, pra não parecer alguém realmente presente. */
  offline?: boolean
}) {
  const corStatusNumero = useMemo(() => Number(status.replace('#', '0x')), [status])
  const desenharIndicadorMemo = useMemo(() => (g: PixiGraphics) => desenharIndicadorStatus(g, corStatusNumero), [corStatusNumero])

  const raizRef = useRef<PixiContainer | null>(null)
  const corpoContainerRef = useRef<PixiContainer | null>(null)
  const spriteRef = useRef<PixiSprite | null>(null)
  const anelProximidadeRef = useRef<PixiGraphics | null>(null)

  const alvoRef = useRef<PosicaoTile>({ x: tileX, y: tileY })
  const inicioGlideRef = useRef<PosicaoTile>({ x: tileX, y: tileY })
  const posicaoAtualRef = useRef<PosicaoTile>({ x: tileX, y: tileY })
  const progressoRef = useRef(1)
  const tempoQuadroRef = useRef(0)
  const quadroAtualRef = useRef(0)
  const tempoPulsoRef = useRef(0)
  const tempoBobRef = useRef(0)
  const direcaoRef = useRef<'esquerda' | 'direita'>('direita')
  const personagemRef = useRef(personagem)
  personagemRef.current = personagem

  // Posição/escala/pivô/textura iniciais só precisam ser aplicados uma vez, na montagem - depois
  // disso quem move é o `useTick` abaixo, direto nos objetos Pixi (nunca mais via prop reativa,
  // pra não ter re-render nenhum disputando com a mutação imperativa).
  useLayoutEffect(() => {
    if (raizRef.current) {
      raizRef.current.x = tileX * TILE_PX + TILE_PX / 2
      raizRef.current.y = tileY * TILE_PX + TILE_PX
    }
    if (corpoContainerRef.current) {
      corpoContainerRef.current.pivot.set(PIVO_BASE.x, PIVO_BASE.y)
    }
    if (spriteRef.current) {
      aplicarQuadro(spriteRef.current, personagem, 0)
    }
    // roda só na montagem de propósito - tileX/tileY/personagem aqui são só o valor inicial;
    // mudanças subsequentes são tratadas pelos efeitos/tick abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Troca de personagem (o usuário salvou uma escolha nova no editor) não depende de mover - a
  // textura do quadro atual precisa atualizar sozinha, sem esperar o próximo passo.
  useLayoutEffect(() => {
    if (spriteRef.current) {
      aplicarQuadro(spriteRef.current, personagem, quadroAtualRef.current)
    }
  }, [personagem])

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
        corpoContainerRef.current.scale.x = direcaoRef.current === 'esquerda' ? -1 : 1
      }
    }
    // posicaoAtualRef de propósito fora das deps: só nos importa o valor no momento em que
    // tileX/tileY mudam (início de um novo glide), não a cada tick que a atualiza.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileX, tileY])

  useTick((ticker) => {
    const andando = progressoRef.current < 1
    if (andando) {
      progressoRef.current = Math.min(1, progressoRef.current + ticker.deltaMS / DURACAO_GLIDE_MS)
      posicaoAtualRef.current = interpolarPosicao(inicioGlideRef.current, alvoRef.current, progressoRef.current)
      if (raizRef.current) {
        raizRef.current.x = posicaoAtualRef.current.x * TILE_PX + TILE_PX / 2
        raizRef.current.y = posicaoAtualRef.current.y * TILE_PX + TILE_PX
      }

      tempoQuadroRef.current += ticker.deltaMS
      if (tempoQuadroRef.current >= DURACAO_QUADRO_MS) {
        tempoQuadroRef.current = 0
        quadroAtualRef.current = (quadroAtualRef.current + 1) % QUADROS_POR_CICLO
        if (spriteRef.current) {
          aplicarQuadro(spriteRef.current, personagemRef.current, quadroAtualRef.current)
        }
      }
    } else if (quadroAtualRef.current !== 0) {
      quadroAtualRef.current = 0
      tempoQuadroRef.current = 0
      if (spriteRef.current) {
        aplicarQuadro(spriteRef.current, personagemRef.current, 0)
      }
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
        <pixiSprite
          ref={spriteRef}
          anchor={{ x: 0.5, y: 1 }}
          x={PIVO_BASE.x}
          y={PIVO_BASE.y}
          width={TAMANHO_SPRITE_PX}
          height={TAMANHO_SPRITE_PX}
        />
        <pixiGraphics draw={desenharIndicadorMemo} />
      </pixiContainer>

      <pixiText
        text={offline ? `${nome} (offline)` : nome}
        anchor={{ x: 0.5, y: 1 }}
        y={-PIVO_BASE.y - 6}
        style={{ fontFamily: 'Nunito, sans-serif', fontSize: 11, fontWeight: '800', fill: COR_TEXTO_NOME, stroke: { color: 0x2b2b3a, width: 3 } }}
      />
    </pixiContainer>
  )
}
