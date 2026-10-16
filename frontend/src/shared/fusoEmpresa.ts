/**
 * "Que dia é" segue o fuso da empresa, igual ao backend (`ClockConfig.FUSO_EMPRESA`) - antes era
 * UTC, e às 21h de Brasília o dia virava (o cronômetro zerava e jornadas que passavam das 21h
 * ficavam partidas em dois dias). Independe do fuso do navegador de quem está usando.
 */
export const FUSO_EMPRESA = 'America/Sao_Paulo'

/** O Brasil não tem horário de verão desde 2019 - meia-noite em São Paulo é sempre 03:00 UTC. */
const DESLOCAMENTO_EMPRESA = '-03:00'

const formatoData = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_EMPRESA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/** "AAAA-MM-DD" do dia de `agora` no fuso da empresa. */
export function hojeNaEmpresa(agora: Date = new Date()): string {
  return formatoData.format(agora)
}

/** "AAAA-MM" do mês de `agora` no fuso da empresa. */
export function mesAtualNaEmpresa(agora: Date = new Date()): string {
  return hojeNaEmpresa(agora).slice(0, 7)
}

/** Instante (ISO, UTC) da meia-noite de `dataIso` ("AAAA-MM-DD") no fuso da empresa - o que a API espera em `inicio`/`fim`. */
export function inicioDoDiaNaEmpresa(dataIso: string): string {
  return new Date(`${dataIso}T00:00:00${DESLOCAMENTO_EMPRESA}`).toISOString()
}
