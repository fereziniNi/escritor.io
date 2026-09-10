import { useCallback, useRef, useState } from 'react'

/** Pedido do usuário: "chamar para reunião pela plataforma" - toast com um botão de ação opcional
 * (ex.: "Entrar no Meet"), além do texto informativo puro que já existia. */
export interface AcaoNotificacao {
  rotulo: string
  aoClicar: () => void
}

export interface ItemNotificacao {
  id: number
  texto: string
  acao?: AcaoNotificacao
}

const DURACAO_MS = 4000

/** Pilha simples de toasts - cada `notificar(texto)` empilha um item e o remove sozinho depois de
 * `DURACAO_MS`. Usado pra proximidade (Fase 3/4) e disponível pra qualquer outro evento do HUD
 * que precise de um aviso passageiro no futuro. */
export function useNotificacoes() {
  const [itens, setItens] = useState<ItemNotificacao[]>([])
  const proximoIdRef = useRef(0)

  const notificar = useCallback((texto: string, acao?: AcaoNotificacao) => {
    const id = proximoIdRef.current++
    setItens((atual) => [...atual, { id, texto, acao }])
    setTimeout(() => {
      setItens((atual) => atual.filter((item) => item.id !== id))
    }, DURACAO_MS)
  }, [])

  return { itens, notificar }
}
