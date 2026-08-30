import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { solicitarCodigo, verificarCodigo } from './api'
import { useAuthStore } from './authStore'
import './LoginPage.css'

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

  if (etapa === 'email') {
    return (
      <div className="login-pagina">
        <div>
          <div className="login-marca">
            <div className="login-marca-icone">🏢</div>
            <h1 className="fonte-jogo">Escritório</h1>
          </div>
          <form
            className="login-cartao"
            onSubmit={(evento) => {
              evento.preventDefault()
              mutacaoSolicitarCodigo.mutate()
            }}
          >
            <h2>Entrar</h2>
            <p className="login-subtitulo">Informe seu e-mail pra receber um código de acesso.</p>
            <div className="login-campo">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(evento) => setEmail(evento.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="login-acoes">
              <button type="submit" disabled={mutacaoSolicitarCodigo.isPending}>
                📨 Enviar código
              </button>
              {mutacaoSolicitarCodigo.isError && (
                <p className="mensagem-erro">Não foi possível enviar o código. Tente novamente.</p>
              )}
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="login-pagina">
      <div>
        <div className="login-marca">
          <div className="login-marca-icone">🏢</div>
          <h1 className="fonte-jogo">Escritório</h1>
        </div>
        <form
          className="login-cartao"
          onSubmit={(evento) => {
            evento.preventDefault()
            mutacaoVerificarCodigo.mutate()
          }}
        >
          <h2>Digite o código</h2>
          <p className="login-subtitulo">Enviamos um código de 6 dígitos para {email}.</p>
          <div className="login-campo">
            <label htmlFor="codigo">Código</label>
            <input
              id="codigo"
              inputMode="numeric"
              value={codigo}
              onChange={(evento) => setCodigo(evento.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="login-acoes">
            <button type="submit" disabled={mutacaoVerificarCodigo.isPending}>
              🔓 Entrar
            </button>
            {mutacaoVerificarCodigo.isError && <p className="mensagem-erro">Código inválido ou expirado.</p>}
          </div>
          <p className="login-rodape">
            <button type="button" className="botao-secundario botao-pequeno" onClick={() => setEtapa('email')}>
              Usar outro e-mail
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}
