import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { listarPessoas } from '../organizacao/api'
import { abrirConversaDireta, enviarMensagem, listarConversas, listarMensagens, marcarConversaComoLida } from './api'
import './Chat.css'
import type { Mensagem } from './types'

type Visao = 'lista' | 'thread' | 'nova'

/**
 * Pedido do usuário: "eu quero que voce deixe um mini chat aberto na lateral esquerda no topo,
 * igual ao tempo mas do lado esquerdo, onde tem as ultimas mensagens e pessoas, igual ao whats,
 * mas em miniatura igual um popup" - substitui tanto o botão/notificação flutuante quanto o
 * painel grande de duas colunas (`ChatPage`, removido) por um popup pequeno e permanentemente
 * montado no canto superior ESQUERDO (`.escritorio-canto-superior-esquerdo` em
 * `EscritorioPage.css`, espelhando `.escritorio-canto-superior-direito` do `CronometroTrabalho`
 * do lado direito). Uma coluna só (sem espaço pra duas lado a lado num popup deste tamanho),
 * navegando entre três telas dentro do mesmo popup - lista de conversas ↔ nova conversa ↔ uma
 * conversa aberta - com um "←" pra voltar, do jeito que o WhatsApp Web mostra uma coisa de cada
 * vez numa tela pequena.
 *
 * <p>"Aberto" por padrão (pedido explícito) - o botão de recolher (▴/▾) no cabeçalho é só uma
 * conveniência extra pra quem quiser esconder temporariamente sem perder o lugar no mapa, não
 * um requisito.
 */
export function ChatMiniWidget({ meuUsuarioId }: { meuUsuarioId: number | null }) {
  const queryClient = useQueryClient()
  const conversasQuery = useQuery({ queryKey: ['chat', 'conversas'], queryFn: listarConversas })
  const [colapsado, setColapsado] = useState(false)
  const [visao, setVisao] = useState<Visao>('lista')
  const [conversaSelecionadaId, setConversaSelecionadaId] = useState<number | null>(null)
  const [filtroPessoas, setFiltroPessoas] = useState('')
  const [textoRascunho, setTextoRascunho] = useState('')
  const mensagensRef = useRef<HTMLDivElement>(null)

  const totalNaoLidas = (conversasQuery.data ?? []).reduce((total, conversa) => total + conversa.naoLidas, 0)

  const mensagensQuery = useQuery({
    queryKey: ['chat', 'mensagens', conversaSelecionadaId],
    queryFn: () => listarMensagens(conversaSelecionadaId!),
    enabled: conversaSelecionadaId !== null,
  })

  // só busca a lista de pessoas quando a tela de "nova conversa" está aberta - não é necessário
  // o resto do tempo.
  const pessoasQuery = useQuery({ queryKey: ['pessoas'], queryFn: listarPessoas, enabled: visao === 'nova' })

  const marcarLidaMutation = useMutation({
    mutationFn: (conversaId: number) => marcarConversaComoLida(conversaId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['chat', 'conversas'] }),
  })

  const abrirDiretaMutation = useMutation({
    mutationFn: (usuarioId: number) => abrirConversaDireta(usuarioId),
    onSuccess: (conversa) => {
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversas'] })
      abrirConversa(conversa.id)
    },
  })

  const enviarMutation = useMutation({
    mutationFn: (texto: string) => enviarMensagem(conversaSelecionadaId!, texto),
    onSuccess: (mensagem) => {
      queryClient.setQueryData<Mensagem[]>(['chat', 'mensagens', conversaSelecionadaId], (atual) => [...(atual ?? []), mensagem])
      queryClient.invalidateQueries({ queryKey: ['chat', 'conversas'] })
      setTextoRascunho('')
    },
  })

  function abrirConversa(conversaId: number) {
    setConversaSelecionadaId(conversaId)
    setVisao('thread')
    marcarLidaMutation.mutate(conversaId)
  }

  useEffect(() => {
    const elemento = mensagensRef.current
    if (elemento && typeof elemento.scrollTo === 'function') {
      elemento.scrollTo({ top: elemento.scrollHeight })
    }
  }, [mensagensQuery.data])

  const conversaSelecionada = conversasQuery.data?.find((conversa) => conversa.id === conversaSelecionadaId) ?? null
  const pessoasFiltradas = (pessoasQuery.data ?? [])
    .filter((pessoa) => pessoa.id !== meuUsuarioId)
    .filter((pessoa) => pessoa.nome.toLowerCase().includes(filtroPessoas.trim().toLowerCase()))

  return (
    <div className="chat-mini">
      <header className="chat-mini-cabecalho">
        {visao !== 'lista' && (
          <button
            type="button"
            className="chat-mini-voltar"
            aria-label="Voltar pra lista de conversas"
            onClick={() => setVisao('lista')}
          >
            ←
          </button>
        )}
        <span className="chat-mini-titulo">
          {visao === 'lista' && '💬 Chat'}
          {visao === 'nova' && 'Nova conversa'}
          {visao === 'thread' &&
            (conversaSelecionada ? `${conversaSelecionada.tipo === 'GERAL' ? '📢' : '👤'} ${conversaSelecionada.nome}` : 'Chat')}
        </span>
        {visao === 'lista' && totalNaoLidas > 0 && (
          <span className="chat-mini-badge" aria-label={`${totalNaoLidas} mensagens não lidas`}>
            {totalNaoLidas > 9 ? '9+' : totalNaoLidas}
          </span>
        )}
        {visao === 'lista' && (
          <button type="button" className="chat-mini-acao" aria-label="Nova conversa" title="Nova conversa" onClick={() => setVisao('nova')}>
            +
          </button>
        )}
        <button
          type="button"
          className="chat-mini-acao"
          aria-label={colapsado ? 'Expandir o chat' : 'Recolher o chat'}
          onClick={() => setColapsado((atual) => !atual)}
        >
          {colapsado ? '▾' : '▴'}
        </button>
      </header>

      {!colapsado && (
        <div className="chat-mini-corpo">
          {visao === 'lista' && (
            <ul className="chat-mini-lista">
              {conversasQuery.isPending && <li className="mensagem-carregando">Carregando…</li>}
              {conversasQuery.isError && <li className="mensagem-erro">Não foi possível carregar as conversas.</li>}
              {conversasQuery.data?.map((conversa) => (
                <li key={conversa.id}>
                  <button type="button" className="chat-mini-item" onClick={() => abrirConversa(conversa.id)}>
                    <span className="chat-mini-item-icone" aria-hidden="true">
                      {conversa.tipo === 'GERAL' ? '📢' : '👤'}
                    </span>
                    <span className="chat-mini-item-info">
                      <span className="chat-mini-item-nome">{conversa.nome}</span>
                      {conversa.ultimaMensagem && (
                        <span className="chat-mini-item-preview">
                          {conversa.ultimaMensagem.autorNome}: {conversa.ultimaMensagem.texto}
                        </span>
                      )}
                    </span>
                    {conversa.naoLidas > 0 && <span className="chat-mini-item-badge">{conversa.naoLidas > 9 ? '9+' : conversa.naoLidas}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {visao === 'nova' && (
            <div className="chat-mini-nova">
              <input
                className="chat-mini-filtro"
                aria-label="Filtrar pessoas"
                value={filtroPessoas}
                onChange={(evento) => setFiltroPessoas(evento.target.value)}
                placeholder="Filtrar por nome"
                autoFocus
              />
              {pessoasQuery.isPending && <p className="mensagem-carregando">Carregando…</p>}
              <ul className="chat-mini-lista">
                {pessoasFiltradas.map((pessoa) => (
                  <li key={pessoa.id}>
                    <button type="button" className="chat-mini-item" onClick={() => abrirDiretaMutation.mutate(pessoa.id)}>
                      <span className="chat-mini-item-nome">{pessoa.nome}</span>
                    </button>
                  </li>
                ))}
                {pessoasQuery.data && pessoasFiltradas.length === 0 && <li className="mensagem-vazia">Ninguém encontrado.</li>}
              </ul>
            </div>
          )}

          {visao === 'thread' && (
            <>
              <div className="chat-mini-mensagens" ref={mensagensRef}>
                {mensagensQuery.isPending && <p className="mensagem-carregando">Carregando…</p>}
                {mensagensQuery.data?.length === 0 && <p className="mensagem-vazia">Nenhuma mensagem ainda - diga oi!</p>}
                {mensagensQuery.data?.map((mensagem) => (
                  <div key={mensagem.id} className={`chat-bolha${mensagem.autorId === meuUsuarioId ? ' chat-bolha--minha' : ''}`}>
                    {mensagem.autorId !== meuUsuarioId && <span className="chat-bolha-autor">{mensagem.autorNome}</span>}
                    <span className="chat-bolha-texto">{mensagem.texto}</span>
                  </div>
                ))}
              </div>
              <form
                className="chat-mini-formulario"
                onSubmit={(evento) => {
                  evento.preventDefault()
                  const texto = textoRascunho.trim()
                  if (texto) {
                    enviarMutation.mutate(texto)
                  }
                }}
              >
                <input
                  aria-label="Mensagem"
                  value={textoRascunho}
                  onChange={(evento) => setTextoRascunho(evento.target.value)}
                  placeholder="Mensagem…"
                  maxLength={2000}
                />
                <button type="submit" aria-label="Enviar" disabled={!textoRascunho.trim() || enviarMutation.isPending}>
                  ➤
                </button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  )
}
