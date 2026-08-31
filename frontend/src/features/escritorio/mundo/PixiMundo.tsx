import { Application, extend } from '@pixi/react'
import { Container, Graphics, Text } from 'pixi.js'
import { useRef } from 'react'
import type { ReactNode } from 'react'

extend({ Container, Graphics, Text })

/**
 * Wrapper de ciclo de vida do canvas Pixi que hospeda o mundo do Escritório (piso, paredes,
 * móveis, avatares - camadas construídas nas próximas etapas da Fase 1/2). `<Application>` do
 * `@pixi/react` já resolve o double-mount do StrictMode internamente (registro de "roots" por
 * elemento canvas, ver node_modules/@pixi/react/lib/components/Application.mjs) - confirmado com
 * um spike renderizando um retângulo placeholder num navegador real via Playwright antes desta
 * versão, sem canvas duplicado/vazado.
 *
 * `resizeTo` aponta pro `<div>` hospedeiro (não pra `window`) - o canvas preenche exatamente o
 * espaço que o layout HUD deixar pro mundo, do mesmo jeito que `.escritorio-coluna-mapa` fazia
 * antes com o mapa em DOM.
 */
export function PixiMundo({ children }: { children: ReactNode }) {
  const hostRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={hostRef} data-testid="mundo-canvas-host" style={{ width: '100%', height: '100%' }}>
      {/* Fundo azul-claro sólido (em vez de transparente pro creme da página) - dá uma
      ambientação de "escritório" coesa mesmo na margem fora do tabuleiro de tiles, quando o
      mundo não preenche 100% da viewport num zoom/proporção específico. */}
      <Application resizeTo={hostRef} background="#dbe6ef" antialias={false}>
        {children}
      </Application>
    </div>
  )
}
