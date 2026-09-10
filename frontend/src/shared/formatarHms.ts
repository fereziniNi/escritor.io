function doisDigitos(numero: number): string {
  return String(numero).padStart(2, '0')
}

/** Formata segundos totais como HH:MM:SS - usado pelos relógios ao vivo do escritório
 * (`CronometroTrabalho`, tempo de trabalho hoje; `CronometroSecao`/`CronometroTarefaAtiva`, tempo
 * de uma tarefa). Extraído daqui pra não duplicar a 3ª vez a mesma conta (regra dos 3). */
export function formatarHms(totalSegundos: number): string {
  const segundos = Math.max(0, Math.floor(totalSegundos))
  const horas = Math.floor(segundos / 3600)
  const minutos = Math.floor((segundos % 3600) / 60)
  const resto = segundos % 60
  return `${doisDigitos(horas)}:${doisDigitos(minutos)}:${doisDigitos(resto)}`
}
