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
