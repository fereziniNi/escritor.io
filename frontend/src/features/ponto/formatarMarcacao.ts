const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

/** "2026-10" (formato da API) -> "Outubro/2026". */
export function formatarMesAno(mes: string): string {
  const [ano, numeroDoMes] = mes.split('-')
  return `${MESES[Number(numeroDoMes) - 1]}/${ano}`
}
