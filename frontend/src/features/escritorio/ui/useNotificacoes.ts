import { useCallback, useRef, useState } from 'react'

export interface ItemNotificacao {
  id: number
  texto: string
}

const DURACAO_MS = 4000

/** Pilha simples de toasts - cada `notificar(texto)` empilha um item e o remove sozinho depois de
 * `DURACAO_MS`. Usado pra proximidade (Fase 3/4) e disponível pra qualquer outro evento do HUD
 * que precise de um aviso passageiro no futuro. */
export function useNotificacoes() {
  const [itens, setItens] = useState<ItemNotificacao[]>([])
  const proximoIdRef = useRef(0)

  const notificar = useCallback((texto: string) => {
    const id = proximoIdRef.current++
    setItens((atual) => [...atual, { id, texto }])
    setTimeout(() => {
      setItens((atual) => atual.filter((item) => item.id !== id))
    }, DURACAO_MS)
  }, [])

  return { itens, notificar }
}
