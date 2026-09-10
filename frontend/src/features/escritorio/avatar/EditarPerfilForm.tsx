import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { atualizarMeuPerfil, buscarMeuUsuario } from './api'

/**
 * Pedido do usuário: "tenha também uma edição de perfil. Nome e email nesse modal" - aba própria
 * de "Configurações pessoais", ao lado de Personagem/Minha escala. Mesmo padrão de rascunho local
 * até salvar do `EditorAvatarPage` (preenche os campos com `GET /usuarios/me` uma vez, depois é só
 * estado local até o Salvar).
 *
 * <p>Limitação conhecida: o nome mostrado na barra de ferramentas/no mundo (Pixi) vem do snapshot
 * de presença em tempo real (WebSocket), não deste formulário - diferente da aparência (que já
 * tem sincronização ao vivo pra isso, `PresencaWebSocketHandler#atualizarAparencia`), um nome
 * trocado aqui só aparece atualizado pros outros (e pra própria pessoa, fora deste modal) depois
 * de reconectar/relogar. Fora de escopo do pedido original, não implementado aqui.
 */
export function EditarPerfilForm() {
  const queryClient = useQueryClient()
  const meuUsuarioQuery = useQuery({ queryKey: ['usuarios', 'me'], queryFn: buscarMeuUsuario })
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [inicializado, setInicializado] = useState(false)

  useEffect(() => {
    if (meuUsuarioQuery.data && !inicializado) {
      setNome(meuUsuarioQuery.data.nome)
      setEmail(meuUsuarioQuery.data.email)
      setInicializado(true)
    }
  }, [meuUsuarioQuery.data, inicializado])

  const salvarMutation = useMutation({
    mutationFn: () => atualizarMeuPerfil(nome.trim(), email.trim()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usuarios', 'me'] })
    },
  })

  if (meuUsuarioQuery.isPending) {
    return <p className="mensagem-carregando">Carregando…</p>
  }

  if (meuUsuarioQuery.isError) {
    return <p className="mensagem-erro">Não foi possível carregar seu perfil.</p>
  }

  return (
    <form
      className="formulario"
      onSubmit={(evento) => {
        evento.preventDefault()
        salvarMutation.mutate()
      }}
    >
      <div className="campo">
        <label htmlFor="perfil-nome">Nome</label>
        <input id="perfil-nome" value={nome} onChange={(evento) => setNome(evento.target.value)} required maxLength={200} />
      </div>
      <div className="campo">
        <label htmlFor="perfil-email">E-mail</label>
        <input
          id="perfil-email"
          type="email"
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
          required
        />
      </div>
      <p className="mensagem-vazia">
        É esse e-mail que recebe o código pra entrar - mudar aqui muda como você faz login da próxima vez.
      </p>
      <div className="linha-botoes">
        <button type="submit" disabled={salvarMutation.isPending}>
          💾 Salvar
        </button>
      </div>
      {salvarMutation.isSuccess && <p className="mensagem-vazia">✅ Perfil atualizado.</p>}
      {salvarMutation.isError && <p className="mensagem-erro">{(salvarMutation.error as Error).message}</p>}
    </form>
  )
}
