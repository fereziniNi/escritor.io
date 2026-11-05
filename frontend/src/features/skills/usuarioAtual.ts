import { decodeJwt } from '../auth/jwt'
import { useAuthStore } from '../auth/authStore'

/** Id do usuário logado (claim `sub` do access token); nulo sem sessão ou com token ilegível. */
export function useUsuarioId(): number | null {
  const token = useAuthStore((s) => s.accessToken)
  if (!token) return null
  try {
    const id = Number(decodeJwt(token).sub)
    return Number.isFinite(id) ? id : null
  } catch {
    return null
  }
}

/** Proposta pendente de outra pessoa (ou do Sistema) numa skill oficial: bloqueia edição e restauração. */
export function propostaDeOutro(
  detalhe: { oficial: boolean; propostaPendente: { autorId: number | null } | null },
  meuId: number | null,
): boolean {
  const p = detalhe.propostaPendente
  return detalhe.oficial && p !== null && (p.autorId === null || p.autorId !== meuId)
}
