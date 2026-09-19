import { useEffect, useRef } from 'react'
import { DURACAO_GLIDE_MS } from './glide'
import { calcularProximaPosicao } from './movimento'
import type { PosicaoTile } from './movimento'

const TECLA_PARA_DELTA: Record<string, readonly [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  w: [0, -1],
  W: [0, -1],
  s: [0, 1],
  S: [0, 1],
  a: [-1, 0],
  A: [-1, 0],
  d: [1, 0],
  D: [1, 0],
}

/** Intervalo entre passos enquanto uma tecla de movimento fica segurada, em ms. Igual à duração do
 * glide visual (`DURACAO_GLIDE_MS`, `glide.ts`) de propósito - um passo novo chega perto de quando
 * o anterior termina de deslizar na tela, então segurar uma seta anda de forma contínua em vez de
 * "passo, pausa, passo". */
const INTERVALO_PASSO_MS = DURACAO_GLIDE_MS

/**
 * Move o próprio jogador por seta ou WASD do teclado - substitui o `window` keydown effect que ficava
 * inline em `EscritorioPage.tsx` (mesma lógica de clamp, agora em `calcularProximaPosicao`,
 * puro/testado). `ativo=false` (ex.: um painel do dock aberto) desliga as setas sem precisar
 * desmontar o listener toda hora. Sem colisão pro resto do mapa de propósito (pedido do usuário:
 * "remover as paredes") - `transicaoBloqueada` (opcional) existe pra quando `EscritorioPage.tsx`
 * precisa reintroduzir alguma barreira escopada (pedido posterior: cabines com parede/porta de
 * verdade, ver `construirGradeColisao.ts`), sem afetar o resto do mapa.
 *
 * Pedido do usuário: "a movimentação do personagem está travando muito... aparenta estar com um
 * ping alto... quero que a locomoção seja flúida". Não era rede - a versão anterior movia um tile
 * por evento `keydown` bruto do navegador, e key-repeat de teclado não foi feito pra jogos: tem um
 * atraso inicial alto antes de começar a repetir (varia por SO/config, tipicamente 300-500ms) e só
 * depois dispara numa cadência que o sistema operacional escolhe, não o app - segurar uma seta
 * sentia exatamente como "trava, depois dispara rápido demais", porque era isso que acontecia de
 * verdade. Correção: rastreia teclas fisicamente seguradas (`keydown`/`keyup` só marcam
 * estado, sem depender de repetição nenhuma) e anda em passos de intervalo fixo próprio
 * (`INTERVALO_PASSO_MS`, via `setInterval`) - o primeiro passo de uma tecla nova sai na hora (sem
 * esperar o intervalo), os seguintes vêm num ritmo constante escolhido por nós, nunca pelo SO de
 * quem está jogando. Perde o foco da janela (trocar de aba, alt-tab) solta tudo, pro personagem
 * nunca ficar andando sozinho caso o `keyup` de verdade não chegue a tempo.
 *
 * Pedido do usuário: "as letras do wasd não estão saindo no chat" - o listener é no `window`
 * (precisa ser, pra funcionar em qualquer lugar da tela), então sem essa checagem ele capturava
 * W/A/S/D digitados em QUALQUER campo de texto focado (o chat, título de reunião, nome de card
 * etc.) - `evento.preventDefault()` impedia a letra de chegar no campo, e ainda por cima movia o
 * personagem por baixo. `estaDigitandoEmCampoDeTexto` ignora a tecla por completo (nem
 * `preventDefault`, nem movimento) sempre que o foco atual é um campo de texto de verdade -
 * WASD/setas só controlam o personagem quando nenhum campo está sendo editado.
 */
function estaDigitandoEmCampoDeTexto(): boolean {
  const elemento = document.activeElement
  if (elemento instanceof HTMLInputElement || elemento instanceof HTMLTextAreaElement) {
    return true
  }
  return elemento instanceof HTMLElement && elemento.isContentEditable
}

export function useMovimentoTeclado({
  ativo,
  posicaoAtual,
  limites,
  mover,
  transicaoBloqueada,
}: {
  ativo: boolean
  posicaoAtual: PosicaoTile | undefined
  limites: { larguraTiles: number; alturaTiles: number }
  mover: (x: number, y: number) => void
  transicaoBloqueada?: (de: PosicaoTile, para: PosicaoTile) => boolean
}) {
  const teclasSeguradasRef = useRef<Set<string>>(new Set())
  const posicaoRef = useRef(posicaoAtual)
  const limitesRef = useRef(limites)
  const moverRef = useRef(mover)
  const transicaoBloqueadaRef = useRef(transicaoBloqueada)
  posicaoRef.current = posicaoAtual
  limitesRef.current = limites
  moverRef.current = mover
  transicaoBloqueadaRef.current = transicaoBloqueada

  useEffect(() => {
    let idIntervalo: ReturnType<typeof window.setInterval> | null = null

    function darUmPasso() {
      if (estaDigitandoEmCampoDeTexto()) return
      const atual = posicaoRef.current
      if (!atual) return
      for (const tecla of teclasSeguradasRef.current) {
        const delta = TECLA_PARA_DELTA[tecla]
        if (!delta) continue
        const proxima = calcularProximaPosicao(atual, delta, limitesRef.current, transicaoBloqueadaRef.current)
        moverRef.current(proxima.x, proxima.y)
        return
      }
    }

    function pararLoop() {
      if (idIntervalo !== null) {
        window.clearInterval(idIntervalo)
        idIntervalo = null
      }
    }

    function soltarTudo() {
      teclasSeguradasRef.current.clear()
      pararLoop()
    }

    if (!ativo) {
      soltarTudo()
      return undefined
    }

    function aoPressionarTecla(evento: KeyboardEvent) {
      if (!TECLA_PARA_DELTA[evento.key]) return
      if (estaDigitandoEmCampoDeTexto()) return
      evento.preventDefault()
      if (teclasSeguradasRef.current.has(evento.key)) {
        // key-repeat nativo reenviando o mesmo keydown - já tratado pelo loop de passos, ignora.
        return
      }
      teclasSeguradasRef.current.add(evento.key)
      if (idIntervalo === null) {
        darUmPasso()
        idIntervalo = window.setInterval(darUmPasso, INTERVALO_PASSO_MS)
      }
    }

    function aoSoltarTecla(evento: KeyboardEvent) {
      teclasSeguradasRef.current.delete(evento.key)
      if (teclasSeguradasRef.current.size === 0) {
        pararLoop()
      }
    }

    window.addEventListener('keydown', aoPressionarTecla)
    window.addEventListener('keyup', aoSoltarTecla)
    window.addEventListener('blur', soltarTudo)
    return () => {
      window.removeEventListener('keydown', aoPressionarTecla)
      window.removeEventListener('keyup', aoSoltarTecla)
      window.removeEventListener('blur', soltarTudo)
      soltarTudo()
    }
  }, [ativo])
}
