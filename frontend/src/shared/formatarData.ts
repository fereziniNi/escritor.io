/**
 * Formata uma data ISO (`AAAA-MM-DD`, ou um instante completo `AAAA-MM-DDTHH:mm:ssZ`) como
 * DD/MM/AAAA - pedido do usuário: "as datas devem sempre ser apresentadas por data dia/mes/ano".
 * Extrai os componentes direto da string em vez de `new Date(...).toLocaleDateString()`: uma data
 * pura (sem hora) interpretada como meia-noite UTC mostraria o dia anterior em qualquer fuso
 * negativo (ex.: Brasil) - fatiar a string evita esse desvio por completo.
 */
export function formatarDataBr(dataIso: string): string {
  const [ano, mes, dia] = dataIso.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

/**
 * Formata um instante ISO completo (`AAAA-MM-DDTHH:mm:ssZ`) como `DD/MM/AAAA HH:mm`, no fuso
 * horário local - pedido do usuário: "no historico deve estar o dia hora e quanto tempo foi
 * feita". Diferente de `formatarDataBr` (que evita `Date` de propósito pra não desviar o dia de
 * uma data pura), aqui o objetivo É converter pro fuso local - `new Date(...)` é o jeito certo,
 * não o problema.
 */
export function formatarDataHoraBr(instanteIso: string): string {
  const data = new Date(instanteIso)
  const dia = String(data.getDate()).padStart(2, '0')
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const ano = data.getFullYear()
  const horas = String(data.getHours()).padStart(2, '0')
  const minutos = String(data.getMinutes()).padStart(2, '0')
  return `${dia}/${mes}/${ano} ${horas}:${minutos}`
}

/**
 * Pedido do usuário: "ver as últimas que chegaram no sistema" - tempo relativo ("agora", "há 5
 * min", "há 2h", "há 3 dias") é mais rápido de escanear numa lista de notificações do que uma
 * data/hora cheia; depois de uma semana, cai pra `formatarDataHoraBr` (tempo relativo de "há 3
 * semanas" pra frente vira mais confuso que útil). `agora` é injetável só pra teste determinístico
 * - por padrão é o momento real.
 */
export function formatarTempoRelativo(instanteIso: string, agora: Date = new Date()): string {
  const minutos = Math.floor((agora.getTime() - new Date(instanteIso).getTime()) / 60000)
  if (minutos < 1) {
    return 'agora'
  }
  if (minutos < 60) {
    return `há ${minutos} min`
  }
  const horas = Math.floor(minutos / 60)
  if (horas < 24) {
    return `há ${horas}h`
  }
  const dias = Math.floor(horas / 24)
  if (dias < 7) {
    return `há ${dias} dia${dias > 1 ? 's' : ''}`
  }
  return formatarDataHoraBr(instanteIso)
}
