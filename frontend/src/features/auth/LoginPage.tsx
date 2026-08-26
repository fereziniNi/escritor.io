import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { solicitarCodigo, verificarCodigo } from './api'
import { useAuthStore } from './authStore'
import { decodeJwt } from './jwt'

export function LoginPage() {
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const definirSessao = useAuthStore((estado) => estado.definirSessao)
  const navigate = useNavigate()

  const mutacaoSolicitarCodigo = useMutation({
    mutationFn: () => solicitarCodigo(email),
    onSuccess: () => setEtapa('codigo'),
  })

  const mutacaoVerificarCodigo = useMutation({
    mutationFn: () => verificarCodigo(email, codigo),
    onSuccess: (tokens) => {
      const claims = decodeJwt(tokens.accessToken)
      definirSessao(tokens.accessToken, claims.papel)
      navigate('/')
    },
  })

  if (etapa === 'email') {
    return (
      <form
        onSubmit={(evento) => {
          evento.preventDefault()
          mutacaoSolicitarCodigo.mutate()
        }}
      >
        <h1>Entrar</h1>
        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(evento) => setEmail(evento.target.value)}
          required
        />
        <button type="submit" disabled={mutacaoSolicitarCodigo.isPending}>
          Enviar código
        </button>
        {mutacaoSolicitarCodigo.isError && <p>Não foi possível enviar o código. Tente novamente.</p>}
      </form>
    )
  }

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault()
        mutacaoVerificarCodigo.mutate()
      }}
    >
      <h1>Digite o código</h1>
      <p>Enviamos um código de 6 dígitos para {email}.</p>
      <label htmlFor="codigo">Código</label>
      <input
        id="codigo"
        inputMode="numeric"
        value={codigo}
        onChange={(evento) => setCodigo(evento.target.value)}
        required
      />
      <button type="submit" disabled={mutacaoVerificarCodigo.isPending}>
        Entrar
      </button>
      {mutacaoVerificarCodigo.isError && <p>Código inválido ou expirado.</p>}
    </form>
  )
}
