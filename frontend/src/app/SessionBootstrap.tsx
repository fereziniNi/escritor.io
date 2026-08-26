import { type ReactNode, useEffect, useState } from 'react'
import { renovarSessao } from '../features/auth/api'
import { useAuthStore } from '../features/auth/authStore'
import { decodeJwt } from '../features/auth/jwt'

export function SessionBootstrap({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true)
  const definirSessao = useAuthStore((estado) => estado.definirSessao)

  useEffect(() => {
    let cancelado = false

    renovarSessao()
      .then((tokens) => {
        if (cancelado || !tokens) {
          return
        }
        const claims = decodeJwt(tokens.accessToken)
        definirSessao(tokens.accessToken, claims.papel)
      })
      .finally(() => {
        if (!cancelado) {
          setCarregando(false)
        }
      })

    return () => {
      cancelado = true
    }
  }, [definirSessao])

  if (carregando) {
    return null
  }

  return <>{children}</>
}
