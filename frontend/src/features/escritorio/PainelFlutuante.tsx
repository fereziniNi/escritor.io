import { useEffect } from 'react'
import type { ReactNode } from 'react'

/**
 * Modal genérico usado pelo dock do Escritório (S6, reskin) - cada função do app (ponto, kanban,
 * relatórios, admin) abre como um painel flutuando por cima do mapa, em vez de navegar pra outra
 * URL: "uma tela só, tudo integrado nela", pedido do usuário depois do roadmap completo. Fecha no
 * X, clicando fora, ou Esc - três jeitos óbvios de sair, nenhum deles surpreendente.
 */
export function PainelFlutuante({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    function aoPressionarTecla(evento: KeyboardEvent) {
      if (evento.key === 'Escape') {
        aoFechar()
      }
    }
    window.addEventListener('keydown', aoPressionarTecla)
    return () => window.removeEventListener('keydown', aoPressionarTecla)
  }, [aoFechar])

  return (
    <div className="escritorio-painel-fundo" onClick={aoFechar}>
      <div className="escritorio-painel" role="dialog" aria-modal="true" aria-label={titulo} onClick={(evento) => evento.stopPropagation()}>
        <div className="escritorio-painel-cabecalho">
          <h3>{titulo}</h3>
          <button type="button" aria-label="Fechar" onClick={aoFechar}>
            ✕
          </button>
        </div>
        <div className="escritorio-painel-corpo">{children}</div>
      </div>
    </div>
  )
}
