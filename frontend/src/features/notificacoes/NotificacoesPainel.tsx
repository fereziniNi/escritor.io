import { formatarTempoRelativo } from '../../shared/formatarData'
import type { Notificacao, TipoNotificacao } from './types'

const ICONE_POR_TIPO: Record<TipoNotificacao, string> = {
  CONVITE_REUNIAO: '📹',
  TAREFA_CONCLUIDA: '✅',
  NOVA_TAREFA: '📋',
  SORTEIO_HAPPY_HOUR: '🎉',
}

/**
 * Pedido do usuário: "ver as últimas que chegaram no sistema" - lista das últimas 30 notificações
 * (o backend já devolve nessa ordem/limite), reaproveitando o mesmo visual da seção "O que fez" de
 * Relatórios (`.lista-cartoes`/`.cartao-item`). Só apresentacional: quem busca os dados e marca
 * como lidas é `EscritorioPage` (o contador do sino precisa da mesma query mesmo com o painel
 * fechado).
 */
export function NotificacoesPainel({ itens }: { itens: Notificacao[] }) {
  if (itens.length === 0) {
    return <p className="mensagem-vazia">Nenhuma notificação por aqui ainda.</p>
  }

  return (
    <ul className="lista-cartoes">
      {itens.map((notificacao) => (
        <li key={notificacao.id} className={`cartao-item${notificacao.lida ? '' : ' cartao-item--nao-lida'}`}>
          <div className="cartao-item-cabecalho">
            <span className="cartao-item-titulo">
              {ICONE_POR_TIPO[notificacao.tipo]} {notificacao.texto}
            </span>
          </div>
          <div className="cartao-item-corpo">
            <span className="cartao-item-meta">{formatarTempoRelativo(notificacao.criadoEm)}</span>
            {notificacao.link && (
              <button
                type="button"
                className="botao-secundario botao-pequeno"
                onClick={() => window.open(notificacao.link!, '_blank')}
              >
                Abrir
              </button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
