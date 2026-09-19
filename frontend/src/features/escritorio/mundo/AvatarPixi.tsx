import { extend, useTick } from '@pixi/react'
import type { Container as PixiContainer, Graphics as PixiGraphics, Sprite as PixiSprite } from 'pixi.js'
import { Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import type { RefObject } from 'react'
import { memo, useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import type { AparenciaAvatar } from '../avatar/aparenciaAvatar'
import { TILE_PX } from './constantes'
import { DURACAO_GLIDE_MS, interpolarPosicao } from './glide'
import type { PosicaoTile } from './movimento'
import { COLUNAS_QUADRO, type Direcao, indiceDoQuadro, obterQuadrosDaFolha, obterTexturaCamada } from './paletteRecolor'
import { CHAVES_CAMADA, type CamadaResolvida, montarCamadas, Z_POS } from './spriteAvatar'

extend({ Container, Graphics, Sprite, Text })

/** Escala aplicada por cima do quadro nativo do sprite LPC (64×64px) - dá um personagem de
 * ~50×50px. Usuário já deixou claro em rodadas anteriores que "muito pequeno" é um problema
 * recorrente - melhor começar generoso e ajustar depois via feedback. */
const ESCALA_AVATAR = 0.78

/** (x,y) local do ponto que fica ancorado na posição-mundo do avatar, dentro do quadro 64×64 - um
 * pouco acima do pé de verdade do sprite, pra "pisar" visualmente no chão em vez de flutuar. */
const PIVO_BASE = { x: 32, y: 58 }

const COR_TEXTO_NOME = 0xffffff

/** Avatar de quem está OFFLINE (desconectou, mas fica exatamente onde estava - o backend não
 * move mais ninguém pra "Fora do trabalho" ao desconectar) renderiza bem apagado - dá pra ver que
 * "tem alguém ali" sem parecer alguém realmente presente/ativo. */
const ALPHA_OFFLINE = 0.45

/** Quantos ms cada quadro do ciclo de passos fica em tela - 9 quadros × 90ms ≈ 810ms por volta
 * completa do ciclo, ritmo parecido com o balanço de perna procedural que existia antes. */
const MS_POR_QUADRO = 90

/** Bob de espera - o corpo balança bem sutilmente mesmo parado. */
const VELOCIDADE_BOB = 0.0035
const AMPLITUDE_BOB_PX = 1.6

const CAMADAS_EM_ORDEM = [...CHAVES_CAMADA].sort((a, b) => Z_POS[a] - Z_POS[b])

function hexParaNumero(cor: string): number {
  return Number(cor.replace('#', '0x'))
}

/** Chave estável (por conteúdo) das especificações de recolorir de uma camada - usada como
 * dependência de efeito no lugar do array `especificacoes` em si (identidade nova a cada
 * `montarCamadas`, mesmo quando o conteúdo não mudou). */
function chaveCamada(camada: CamadaResolvida): string {
  return camada.especificacoes.map((e) => `${e.material}:${e.corAlvo}`).join(',')
}

function desenharSombraAvatar(g: PixiGraphics): void {
  g.clear()
  g.ellipse(PIVO_BASE.x, PIVO_BASE.y + 2, 15, 5)
  g.fill({ color: 0x000000, alpha: 0.22 })
}

function desenharAnelDestaque(g: PixiGraphics): void {
  g.clear()
  g.circle(PIVO_BASE.x, PIVO_BASE.y - 26, 28)
  g.stroke({ width: 2.5, color: 0xffd166, alpha: 0.9 })
}

function desenharAnelProximidade(g: PixiGraphics): void {
  g.clear()
  g.circle(PIVO_BASE.x, PIVO_BASE.y - 26, 32)
  g.stroke({ width: 2, color: 0x4fa8d6 })
}

/** Pedido do usuário: "voice... Implemente da melhor maneira possível" - anel verde de "falando
 * agora" (`useVozProximidade.ts`, detecção de volume do stream), mais externo que os outros dois
 * pra não se confundir com destaque/proximidade quando os três coincidem. */
function desenharAnelFalando(g: PixiGraphics): void {
  g.clear()
  g.circle(PIVO_BASE.x, PIVO_BASE.y - 26, 36)
  g.stroke({ width: 2.5, color: 0x4ade80, alpha: 0.9 })
}

function desenharIndicadorStatus(g: PixiGraphics, cor: number): void {
  g.clear()
  g.circle(PIVO_BASE.x + 18, PIVO_BASE.y - 4, 4.5)
  g.fill({ color: cor })
  g.stroke({ width: 1.3, color: 0x1c1a28 })
}

/**
 * 1 camada do personagem - carrega a textura (recolorida via `paletteRecolor.ts` quando a camada
 * pede, ou usada como está quando é uma pasta "pré-colorida" do LPC) de forma assíncrona (imagem +
 * canvas), e enquanto isso fica invisível (sem flash de textura errada). Depois de carregada, troca
 * o quadro sozinha a cada tick a partir dos refs compartilhados do pai (direção/tempo/progresso do
 * glide) - nenhum estado React por trás disso, só mutação imperativa do `Sprite`, mesma disciplina
 * de performance das rodadas anteriores desta sessão.
 *
 * Pedido do usuário: "o personagem está 'travando' ao andar muito" - achado depois que marcar
 * `AvatarPixi` com `memo` (rodada anterior desta correção) não resolveu: aquilo só cortava
 * re-render do React, mas o `useTick` daqui é um listener direto no `Ticker` do Pixi, registrado
 * uma vez no mount - roda a 60fps pra CADA camada de CADA avatar (até ~9 por pessoa) o tempo
 * TODO, `memo` nenhum evita isso, porque não é o React quem está re-executando esse código.
 * Antes, `spriteRef.current.texture = ...` era reatribuído em TODO tick, mesmo parado (o quadro
 * parado é sempre o mesmo índice) - trabalho puro perdido, sem efeito visual nenhum, só ficou
 * caro de mais com a lista de avatares muito maior depois da correção "não estou vendo meus
 * colegas" (todo mundo da empresa sempre presente no mapa, não só quem já tinha conectado antes).
 * `ultimoIndiceRef` faz o `Sprite.texture` só ser tocado quando o índice do quadro realmente muda
 * (andando de verdade, ou trocando de direção) - parado, o custo por frame cai a zero.
 */
function CamadaSprite({
  camada,
  direcaoRef,
  tempoAnimadoRef,
  progressoRef,
}: {
  camada: CamadaResolvida
  direcaoRef: RefObject<Direcao>
  tempoAnimadoRef: RefObject<number>
  progressoRef: RefObject<number>
}) {
  const spriteRef = useRef<PixiSprite | null>(null)
  const quadrosRef = useRef<Texture[] | null>(null)
  const ultimoIndiceRef = useRef(-1)

  useLayoutEffect(() => {
    let cancelado = false
    quadrosRef.current = null
    ultimoIndiceRef.current = -1
    if (spriteRef.current) spriteRef.current.visible = false

    obterTexturaCamada(camada.url, camada.especificacoes).then((folha) => {
      if (cancelado) return
      quadrosRef.current = obterQuadrosDaFolha(folha)
      if (spriteRef.current) {
        spriteRef.current.texture = quadrosRef.current[0]
        spriteRef.current.visible = true
        ultimoIndiceRef.current = 0
      }
    })

    return () => {
      cancelado = true
    }
    // dependência pelo conteúdo (não pela identidade do array `especificacoes`, que muda toda
    // renderização) - `chaveCamada` é estável enquanto url/material/cor não mudam de verdade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camada.url, chaveCamada(camada)])

  useTick(() => {
    const quadros = quadrosRef.current
    if (!quadros || !spriteRef.current) return
    const quadro = progressoRef.current < 1 ? Math.floor(tempoAnimadoRef.current / MS_POR_QUADRO) % COLUNAS_QUADRO : 0
    const indice = indiceDoQuadro(direcaoRef.current, quadro)
    if (indice === ultimoIndiceRef.current) return
    ultimoIndiceRef.current = indice
    spriteRef.current.texture = quadros[indice]
  })

  return <pixiSprite ref={spriteRef} visible={false} texture={Texture.EMPTY} />
}

/**
 * Avatar no mundo Pixi - pilha de `pixiSprite` (pixel art real, LPC - ver `spriteAvatar.ts`), uma
 * camada por categoria (Skin/Hair/Facial hair/Top/Jacket/Bottom/Shoes/Hat/Glasses/Other), na ordem
 * de `Z_POS`. Só recebe a posição em tile *confirmada* (inteira, vinda do servidor via
 * `usePresencaWebSocket`); toda a suavização visual (glide entre tiles, direção real de 4 vias
 * norte/oeste/sul/leste inferida do delta, ciclo de passos de verdade enquanto anda, bob de espera,
 * pulso de proximidade) é interna, dirigida por `useTick`.
 *
 * Perf (lição das duas rodadas de correção desta sessão): nada aqui passa por `useState` - os
 * objetos Pixi (`Container`/`Sprite`/`Graphics`) são mutados direto via `ref` dentro do `useTick`.
 *
 * Envolto em `memo` (pedido do usuário: "o personagem está 'travando' ao andar muito") - `
 * SeguidorCamera` re-renderiza `CamadaMundo` a até 60fps enquanto a câmera ainda está convergindo
 * pro jogador (deliberado, ver o comentário de `EPSILON_CONVERGENCIA` em `SeguidorCamera.tsx` -
 * "acontece exatamente enquanto anda"), e {@code CamadaMundo} desenha um `AvatarPixi` por pessoa
 * presente no escritório - inclusive OFFLINE, desde que "não estou vendo meus colegas" passou a
 * semear todo mundo da empresa no mapa, não só quem já tinha conectado. Sem `memo`, cada um desses
 * até-60 re-renders por segundo reexecutava a função inteira (recalculando `useMemo`/`useCallback`)
 * de TODOS os avatares, mesmo os que não mudaram nada - com poucos colegas isso não incomodava, com
 * a lista inteira da empresa sempre visível, sim. As props de quem não mudou (posição, aparência,
 * status) continuam sendo a MESMA referência entre um tick e outro (`usuarios` só troca de
 * identidade quando uma mensagem de presença de verdade chega, não a cada tick de câmera - ver
 * `usePresencaWebSocket.ts`), então a comparação rasa padrão do `memo` já é suficiente pra pular
 * o avatar inteiro na maioria desses re-renders.
 */
function AvatarPixiBase({
  tileX,
  tileY,
  nome,
  aparencia,
  status,
  destaque,
  proximo = false,
  falando = false,
  offline = false,
}: {
  tileX: number
  tileY: number
  nome: string
  aparencia: AparenciaAvatar
  /** Cor do status (`COR_STATUS[status]`) - só usada pro pontinho indicador. */
  status: string
  destaque: boolean
  /** Fase 3 - alguém está dentro do raio de proximidade deste avatar (`proximidade.ts`). */
  proximo?: boolean
  /** Pedido do usuário: "voice" - a voz deste usuário está ativa agora (`useVozProximidade.ts`). */
  falando?: boolean
  /** Backend marcou esse usuário como OFFLINE (desconectou, fica parado exatamente onde estava) -
   * avatar renderiza apagado + nome com sufixo, pra não parecer alguém realmente presente. */
  offline?: boolean
}) {
  const corStatusNumero = useMemo(() => hexParaNumero(status), [status])
  const camadas = useMemo(() => montarCamadas(aparencia), [aparencia])

  const desenharIndicadorMemo = useCallback((g: PixiGraphics) => desenharIndicadorStatus(g, corStatusNumero), [corStatusNumero])

  const raizRef = useRef<PixiContainer | null>(null)
  const corpoContainerRef = useRef<PixiContainer | null>(null)
  const anelProximidadeRef = useRef<PixiGraphics | null>(null)
  const anelFalandoRef = useRef<PixiGraphics | null>(null)

  const alvoRef = useRef<PosicaoTile>({ x: tileX, y: tileY })
  const inicioGlideRef = useRef<PosicaoTile>({ x: tileX, y: tileY })
  const posicaoAtualRef = useRef<PosicaoTile>({ x: tileX, y: tileY })
  const progressoRef = useRef(1)
  const tempoAnimadoRef = useRef(0)
  const tempoPulsoRef = useRef(0)
  const tempoBobRef = useRef(0)
  const direcaoRef = useRef<Direcao>('sul')

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

    const dx = tileX - partida.x
    const dy = tileY - partida.y
    if (dx !== 0) direcaoRef.current = dx < 0 ? 'oeste' : 'leste'
    else if (dy !== 0) direcaoRef.current = dy < 0 ? 'norte' : 'sul'
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
    }

    if (proximo && anelProximidadeRef.current) {
      tempoPulsoRef.current += ticker.deltaMS
      anelProximidadeRef.current.alpha = 0.5 + Math.sin(tempoPulsoRef.current * 0.004) * 0.3
    }

    if (falando && anelFalandoRef.current) {
      tempoPulsoRef.current += ticker.deltaMS
      // pulso mais rápido que o de proximidade - "falando" é um sinal mais imediato/vivo.
      anelFalandoRef.current.alpha = 0.6 + Math.sin(tempoPulsoRef.current * 0.01) * 0.35
    }

    // Pedido do usuário: "travando ao andar muito" - OFFLINE é gente estacionada, parada de
    // verdade (não é só "sem se mexer agora") - balançar um avatar que nunca vai andar de novo
    // (até reconectar) é custo puro sem efeito visual que valha a pena, multiplicado por quantos
    // colegas offline estão sempre no mapa desde a correção "não estou vendo meus colegas".
    if (!offline) {
      tempoBobRef.current += ticker.deltaMS
      if (corpoContainerRef.current) {
        corpoContainerRef.current.y = Math.sin(tempoBobRef.current * VELOCIDADE_BOB) * AMPLITUDE_BOB_PX
      }
    }
  })

  return (
    <pixiContainer ref={raizRef} alpha={offline ? ALPHA_OFFLINE : 1}>
      <pixiContainer ref={corpoContainerRef}>
        <pixiGraphics draw={desenharSombraAvatar} />
        {destaque && <pixiGraphics draw={desenharAnelDestaque} />}
        {proximo && <pixiGraphics ref={anelProximidadeRef} draw={desenharAnelProximidade} />}
        {falando && <pixiGraphics ref={anelFalandoRef} draw={desenharAnelFalando} />}
        {CAMADAS_EM_ORDEM.map((chave) => {
          const camada = camadas[chave]
          if (!camada) return null
          return <CamadaSprite key={chave} camada={camada} direcaoRef={direcaoRef} tempoAnimadoRef={tempoAnimadoRef} progressoRef={progressoRef} />
        })}
        <pixiGraphics draw={desenharIndicadorMemo} />
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

export const AvatarPixi = memo(AvatarPixiBase)
