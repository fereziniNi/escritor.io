import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { solicitarCodigo, verificarCodigo } from './api'
import { useAuthStore } from './authStore'
import './LoginPage.css'

const RECURSOS = [
  { icone: '🟢', texto: 'Presença em tempo real, sem precisar perguntar "você está aí?"' },
  { icone: '🗂️', texto: 'Projetos em Kanban, ponto e relatórios no mesmo lugar' },
  { icone: '🚪', texto: 'Entra na hora, sem senha pra decorar - só um código no e-mail' },
]

/**
 * Tela de login - segunda geração (a primeira era só um `<form>` sem estilo próprio; a redesenhada
 * anterior era um cartão único flutuando sozinho numa página vazia, sem nenhuma personalidade do
 * produto - usuário: "extremamente feio e não esta fácil de usar"). Vitrine (metade esquerda,
 * some abaixo de ~880px) apresenta a marca de verdade - título, gancho de valor, 3 recursos - em
 * vez de deixar 80% da tela em branco; o cartão de formulário fica sozinho no lado direito, mais
 * respirado, com indicador de progresso (2 passos: e-mail -> código) pra deixar claro onde a
 * pessoa está no fluxo, ícone dentro do campo, e a ação de trocar de e-mail como link discreto em
 * vez de um 2º botão competindo com o principal.
 */
export function LoginPage() {
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const autenticarComTokens = useAuthStore((estado) => estado.autenticarComTokens)
  const navigate = useNavigate()

  const mutacaoSolicitarCodigo = useMutation({
    mutationFn: () => solicitarCodigo(email),
    onSuccess: () => setEtapa('codigo'),
  })

  const mutacaoVerificarCodigo = useMutation({
    mutationFn: () => verificarCodigo(email, codigo),
    onSuccess: (tokens) => {
      autenticarComTokens(tokens)
      navigate('/')
    },
  })

  return (
    <div className="login-pagina">
      <section className="login-vitrine">
        <div className="login-vitrine-padrao" aria-hidden="true" />
        <div className="login-vitrine-conteudo">
          <div className="login-marca">
            <span className="login-marca-icone" aria-hidden="true">
              🏢
            </span>
            <h1 className="fonte-jogo">Escritório</h1>
          </div>
          <p className="login-vitrine-tagline">Seu escritório virtual, sempre de portas abertas.</p>
          <ul className="login-vitrine-recursos">
            {RECURSOS.map((recurso) => (
              <li key={recurso.texto}>
                <span aria-hidden="true">{recurso.icone}</span>
                {recurso.texto}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="login-formulario-coluna">
        <div className="login-marca login-marca-compacta">
          <span className="login-marca-icone" aria-hidden="true">
            🏢
          </span>
          <h1 className="fonte-jogo">Escritório</h1>
        </div>

        <div className="login-cartao">
          <ol className="login-passos" aria-hidden="true">
            <li className="login-passo login-passo-feita" />
            <li className={`login-passo-linha${etapa === 'codigo' ? ' login-passo-linha-feita' : ''}`} />
            <li className={`login-passo${etapa === 'codigo' ? ' login-passo-feita' : ''}`} />
          </ol>

          {etapa === 'email' ? (
            <form
              onSubmit={(evento) => {
                evento.preventDefault()
                mutacaoSolicitarCodigo.mutate()
              }}
            >
              <h2>Entrar</h2>
              <p className="login-subtitulo">Informe seu e-mail pra receber um código de acesso.</p>
              <div className="login-campo">
                <label htmlFor="email">E-mail</label>
                <div className="login-campo-input">
                  <span className="login-campo-icone" aria-hidden="true">
                    ✉️
                  </span>
                  <input
                    id="email"
                    type="email"
                    placeholder="voce@empresa.com"
                    value={email}
                    onChange={(evento) => setEmail(evento.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="login-acoes">
                <button type="submit" disabled={mutacaoSolicitarCodigo.isPending}>
                  {mutacaoSolicitarCodigo.isPending ? 'Enviando…' : '📨 Enviar código'}
                </button>
                {mutacaoSolicitarCodigo.isError && (
                  <p className="mensagem-erro">Não foi possível enviar o código. Tente novamente.</p>
                )}
              </div>
            </form>
          ) : (
            <form
              onSubmit={(evento) => {
                evento.preventDefault()
                mutacaoVerificarCodigo.mutate()
              }}
            >
              <h2>Digite o código</h2>
              <p className="login-subtitulo">
                Enviamos um código de 6 dígitos para <strong>{email}</strong>.
              </p>
              <div className="login-campo">
                <label htmlFor="codigo">Código</label>
                <div className="login-campo-input">
                  <span className="login-campo-icone" aria-hidden="true">
                    🔢
                  </span>
                  <input
                    id="codigo"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    className="login-campo-codigo"
                    value={codigo}
                    onChange={(evento) => setCodigo(evento.target.value)}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="login-acoes">
                <button type="submit" disabled={mutacaoVerificarCodigo.isPending}>
                  {mutacaoVerificarCodigo.isPending ? 'Entrando…' : '🔓 Entrar'}
                </button>
                {mutacaoVerificarCodigo.isError && <p className="mensagem-erro">Código inválido ou expirado.</p>}
              </div>
              <p className="login-rodape">
                <button type="button" className="login-link-voltar" onClick={() => setEtapa('email')}>
                  ← Usar outro e-mail
                </button>
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  )
}
