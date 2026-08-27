export function formatarMinutos(minutos: number): string {
  const horas = Math.floor(minutos / 60)
  const minutosRestantes = minutos % 60
  return `${horas}h${String(minutosRestantes).padStart(2, '0')}`
}

export function formatarSaldo(minutos: number): string {
  const sinal = minutos < 0 ? '-' : '+'
  return `${sinal}${formatarMinutos(Math.abs(minutos))}`
}

const RÓTULOS_ESTADO: Record<string, string> = {
  ABERTA: 'Em andamento',
  FECHADA: 'Fechada',
  INCONSISTENTE: 'Inconsistente',
}

export function formatarEstado(estado: string): string {
  return RÓTULOS_ESTADO[estado] ?? estado
}
