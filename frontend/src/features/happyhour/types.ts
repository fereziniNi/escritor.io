/** Pedido do usuário: "ver as atividades para happy hour onde qualquer um pode adicionar uma nova
 * 'atividade'... uma parte para roleta onde será sorteado qual atividade será feita" -
 * `sorteadaEm` não nulo marca a atividade ATUALMENTE escolhida pela roleta (no máximo uma por
 * vez). */
export interface Atividade {
  id: number
  descricao: string
  sugeridaPorNome: string
  criadaEm: string
  sorteadaEm: string | null
}
