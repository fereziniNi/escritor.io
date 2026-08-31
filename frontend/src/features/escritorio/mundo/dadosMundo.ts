import type { PortaOverride } from './tipos'

/** Override de borda de porta por id de zona - vazio por enquanto (as 3 zonas seedadas hoje usam
 * o padrão de porta na borda sul, que já funciona bem pra elas: todas ficam na fileira y=0..4 do
 * mapa, com a área aberta logo abaixo). */
export const PORTAS_OVERRIDE: PortaOverride[] = []
