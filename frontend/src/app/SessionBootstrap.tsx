import { type ReactNode, useEffect, useState } from 'react'
import { renovarSessao } from '../features/auth/api'
import { useAuthStore } from '../features/auth/authStore'

export function SessionBootstrap({ children }: { children: ReactNode }) {
  const [carregando, setCarregando] = useState(true)
  const autenticarComTokens = useAuthStore((estado) => estado.autenticarComTokens)

  useEffect(() => {
    let cancelado = false

    renovarSessao()
      .then((tokens) => {
        if (cancelado || !tokens) {
          return
        }
        autenticarComTokens(tokens)
      })
      .finally(() => {
        if (!cancelado) {
          setCarregando(false)
        }
      })

    return () => {
      cancelado = true
    }
  }, [autenticarComTokens])

  if (carregando) {
    return null
  }

  return <>{children}</>
}
