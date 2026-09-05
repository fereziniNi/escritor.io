/** Um dia da grade do calendário mensal - inclui dias do mês anterior/seguinte só pra preencher a
 * primeira/última semana (`noMesAtual: false`), igual a qualquer grade de calendário. */
export interface DiaDaGrade {
  /** "AAAA-MM-DD". */
  data: string
  dia: number
  noMesAtual: boolean
}

function comZero(numero: number, digitos: number): string {
  return String(numero).padStart(digitos, '0')
}

function formatarData(ano: number, mes: number, dia: number): string {
  return `${comZero(ano, 4)}-${comZero(mes, 2)}-${comZero(dia, 2)}`
}

/**
 * Sem biblioteca de calendário nova (nenhuma no projeto ainda) - `Date.UTC`/`getUTC*` em vez de
 * `new Date(ano, mes, dia)`/`getDate()` locais, mesma disciplina de `limitesDoDiaUtc.ts`: evita
 * qualquer desvio de fuso horário na aritmética de data pura.
 */
function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

function diaDaSemana(ano: number, mes: number, dia: number): number {
  return new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay() // 0 = domingo .. 6 = sábado
}

/**
 * Gera as datas de um mês pro grid semanal (pedido do usuário: "o calendário deve ser fácil de
 * adicionar as datas e horários") - semana começando na segunda-feira (convenção já usada no
 * padrão semanal, `DayOfWeek.MONDAY` primeiro). Preenche os dias do mês anterior/seguinte pra
 * completar a primeira e a última semana, como qualquer grade de calendário.
 */
export function construirGradeDoMes(ano: number, mes: number): DiaDaGrade[] {
  const totalDeDiasNoMes = diasNoMes(ano, mes)
  const diaSemanaDoPrimeiro = diaDaSemana(ano, mes, 1) // 0=domingo..6=sábado
  // quantos dias do mês anterior entram antes do dia 1 (semana começa na segunda)
  const preenchimentoInicial = (diaSemanaDoPrimeiro + 6) % 7

  const mesAnterior = mes === 1 ? 12 : mes - 1
  const anoDoMesAnterior = mes === 1 ? ano - 1 : ano
  const diasNoMesAnterior = diasNoMes(anoDoMesAnterior, mesAnterior)

  const mesSeguinte = mes === 12 ? 1 : mes + 1
  const anoDoMesSeguinte = mes === 12 ? ano + 1 : ano

  const grade: DiaDaGrade[] = []

  for (let i = 0; i < preenchimentoInicial; i++) {
    const dia = diasNoMesAnterior - preenchimentoInicial + i + 1
    grade.push({ data: formatarData(anoDoMesAnterior, mesAnterior, dia), dia, noMesAtual: false })
  }

  for (let dia = 1; dia <= totalDeDiasNoMes; dia++) {
    grade.push({ data: formatarData(ano, mes, dia), dia, noMesAtual: true })
  }

  // completa até fechar semanas de 7 dias (múltiplo de 7 no total)
  const restante = (7 - (grade.length % 7)) % 7
  for (let dia = 1; dia <= restante; dia++) {
    grade.push({ data: formatarData(anoDoMesSeguinte, mesSeguinte, dia), dia, noMesAtual: false })
  }

  return grade
}
