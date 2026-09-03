import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { caminhoMiniatura, PERSONAGENS, PERSONAGEM_PADRAO, type Personagem } from './personagens'
import { atualizarMeuPersonagem, buscarMeuUsuario } from './api'
import './avatar.css'

/**
 * Editor de personagem (pedido do usuário: "adicionar game-assets... sobre characteres" - depois
 * de pesquisar pacotes prontos, escolhemos o Kenney RPG Urban Pack, CC0, ver `personagens.ts`).
 * Bem mais simples que a versão anterior por camadas (pele/cabelo/roupa/acessórios com abas e
 * grades de swatch de cor): agora é uma escolha única entre os 6 personagens prontos - grade de
 * miniaturas, clique seleciona, "Finalizar" salva. Aberto pela bolha do próprio avatar em
 * `MenuUsuario` (mesmo painel flutuante que todo o resto do dock já usa).
 *
 * O rascunho (`selecionado`) só é aplicado no mundo/nos outros usuários quando "Finalizar" salva
 * de verdade (`PATCH /usuarios/me/aparencia`) - até lá é só local, pra poder pré-visualizar sem
 * afetar ninguém.
 */
export function EditorAvatarPage() {
  const queryClient = useQueryClient()
  const meuUsuarioQuery = useQuery({ queryKey: ['usuarios', 'me'], queryFn: buscarMeuUsuario })
  const [selecionado, setSelecionado] = useState<Personagem>(PERSONAGEM_PADRAO)
  const [rascunhoInicializado, setRascunhoInicializado] = useState(false)

  useEffect(() => {
    if (meuUsuarioQuery.data && !rascunhoInicializado) {
      setSelecionado(meuUsuarioQuery.data.personagem)
      setRascunhoInicializado(true)
    }
  }, [meuUsuarioQuery.data, rascunhoInicializado])

  const salvarMutation = useMutation({
    mutationFn: () => atualizarMeuPersonagem(selecionado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios', 'me'] })
    },
  })

  if (meuUsuarioQuery.isPending) {
    return <p className="mensagem-carregando">Carregando…</p>
  }

  if (meuUsuarioQuery.isError) {
    return <p className="mensagem-erro">Não foi possível carregar seu avatar.</p>
  }

  return (
    <div className="editor-avatar">
      <div className="editor-avatar-previa" aria-hidden="true">
        <img src={caminhoMiniatura(selecionado)} width={64} height={64} style={{ imageRendering: 'pixelated' }} alt="" />
      </div>

      <div className="editor-avatar-galeria" role="group" aria-label="Escolha o personagem">
        {PERSONAGENS.map((personagem) => (
          <button
            key={personagem.id}
            type="button"
            className={`editor-avatar-opcao-personagem${personagem.id === selecionado ? ' editor-avatar-opcao-personagem-selecionada' : ''}`}
            aria-pressed={personagem.id === selecionado}
            onClick={() => setSelecionado(personagem.id)}
          >
            <img src={caminhoMiniatura(personagem.id)} width={40} height={40} style={{ imageRendering: 'pixelated' }} alt="" />
            <span>{personagem.rotulo}</span>
          </button>
        ))}
      </div>

      <div className="editor-avatar-rodape">
        <button type="button" className="botao-pequeno" disabled={salvarMutation.isPending} onClick={() => salvarMutation.mutate()}>
          {salvarMutation.isPending ? 'Salvando…' : 'Finalizar'}
        </button>
        {salvarMutation.isError && <p className="mensagem-erro">Não foi possível salvar o personagem.</p>}
        {salvarMutation.isSuccess && <p className="mensagem-sucesso">Personagem salvo!</p>}
      </div>
    </div>
  )
}
