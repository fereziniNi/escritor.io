/** Paleta fixa de pares fundo/texto com contraste legível (texto escuro sobre fundo claro). */
const PALETA: ReadonlyArray<{ fundo: string; texto: string }> = [
  { fundo: '#dbeafe', texto: '#1e3a8a' },
  { fundo: '#dcfce7', texto: '#14532d' },
  { fundo: '#fef3c7', texto: '#78350f' },
  { fundo: '#fce7f3', texto: '#831843' },
  { fundo: '#ede9fe', texto: '#4c1d95' },
  { fundo: '#ffedd5', texto: '#7c2d12' },
]

/** Cor determinística por projeto: o mesmo id sempre cai no mesmo par da paleta. */
export function corDoProjeto(projetoId: number): { fundo: string; texto: string } {
  const indice = ((Math.trunc(projetoId) % PALETA.length) + PALETA.length) % PALETA.length
  return PALETA[indice]
}
