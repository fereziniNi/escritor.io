/**
 * Pedido do usuário: "Mostre sempre as horas menor que 1 hora em minutos, as marcações de tempo
 * devem ser em horas e minutos, formatado de forma clara e objetiva" - abaixo de 1h, só minutos
 * ("45 min", nunca "0h45"); a partir de 1h, horas e minutos por extenso ("1h30min", não "1h30" -
 * sem a unidade, o "30" fica ambíguo); hora exata sem sobra de minuto não carrega "00min" à toa
 * ("2h", não "2h00min").
 */
export function formatarMinutos(minutos: number): string {
  const horas = Math.floor(minutos / 60)
  const minutosRestantes = minutos % 60
  if (horas === 0) {
    return `${minutosRestantes} min`
  }
  return minutosRestantes === 0 ? `${horas}h` : `${horas}h${String(minutosRestantes).padStart(2, '0')}min`
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
