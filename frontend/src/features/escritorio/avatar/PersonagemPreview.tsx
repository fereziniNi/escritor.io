import { useEffect, useRef } from 'react'
import { COLUNAS_QUADRO, type Direcao, LINHA_DA_DIRECAO, obterCanvasCamada, TAMANHO_QUADRO } from '../mundo/paletteRecolor'
import { CHAVES_CAMADA, montarCamadas, Z_POS } from '../mundo/spriteAvatar'
import type { AparenciaAvatar } from './aparenciaAvatar'

const CAMADAS_EM_ORDEM = [...CHAVES_CAMADA].sort((a, b) => Z_POS[a] - Z_POS[b])

/** Mesmo ritmo de `AvatarPixi.tsx` (`MS_POR_QUADRO`) - só usado aqui quando `andando` é `true`. */
const MS_POR_QUADRO = 90

/**
 * Substitui `PixelCharacterSvg.tsx` (apagado - pedido explícito do usuário: "não faça mais o
 * personagem com svg"). Canvas 2D puro, sem Pixi: compõe as mesmas camadas de sprite real que
 * `AvatarPixi.tsx` usa no mundo (`spriteAvatar.ts`/`paletteRecolor.ts`), num quadro só (64×64,
 * `imageRendering: pixelated`) - usado tanto nas miniaturas/prévia grande do editor
 * (`EditorAvatarPage.tsx`) quanto na bolha da toolbar (`MenuUsuario.tsx`). Mesma assinatura de
 * props do componente antigo, drop-in.
 */
export function PersonagemPreview({
  aparencia,
  corStatus,
  direcao,
  andando,
  destaque,
}: {
  aparencia: AparenciaAvatar
  corStatus?: string
  direcao: 'esquerda' | 'direita'
  andando: boolean
  destaque: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    let cancelado = false
    let intervaloId: ReturnType<typeof setInterval> | undefined
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return

    const camadas = montarCamadas(aparencia)
    const linha = LINHA_DA_DIRECAO[direcao === 'esquerda' ? 'oeste' : ('leste' as Direcao)]
    let quadro = 0

    function desenhar(folhas: (HTMLCanvasElement | null)[]) {
      if (!ctx) return
      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, TAMANHO_QUADRO, TAMANHO_QUADRO)
      if (destaque) {
        ctx.save()
        ctx.strokeStyle = '#ffd166'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(TAMANHO_QUADRO / 2, TAMANHO_QUADRO / 2, TAMANHO_QUADRO / 2 - 2, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }
      for (const folha of folhas) {
        if (!folha) continue
        ctx.drawImage(folha, quadro * TAMANHO_QUADRO, linha * TAMANHO_QUADRO, TAMANHO_QUADRO, TAMANHO_QUADRO, 0, 0, TAMANHO_QUADRO, TAMANHO_QUADRO)
      }
      if (corStatus) {
        ctx.beginPath()
        ctx.arc(TAMANHO_QUADRO - 9, TAMANHO_QUADRO - 11, 5, 0, Math.PI * 2)
        ctx.fillStyle = corStatus
        ctx.fill()
        ctx.lineWidth = 1.3
        ctx.strokeStyle = '#1c1a28'
        ctx.stroke()
      }
    }

    Promise.all(
      CAMADAS_EM_ORDEM.map((chave) => {
        const camada = camadas[chave]
        return camada ? obterCanvasCamada(camada.url, camada.especificacoes) : Promise.resolve(null)
      }),
    ).then((folhas) => {
      if (cancelado) return
      desenhar(folhas)
      if (!andando) return
      intervaloId = setInterval(() => {
        quadro = (quadro + 1) % COLUNAS_QUADRO
        desenhar(folhas)
      }, MS_POR_QUADRO)
    })

    return () => {
      cancelado = true
      if (intervaloId) clearInterval(intervaloId)
    }
  }, [aparencia, corStatus, direcao, andando, destaque])

  return (
    <canvas
      ref={canvasRef}
      width={TAMANHO_QUADRO}
      height={TAMANHO_QUADRO}
      className="personagem-preview"
      style={{ imageRendering: 'pixelated' }}
      aria-hidden="true"
    />
  )
}
