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
