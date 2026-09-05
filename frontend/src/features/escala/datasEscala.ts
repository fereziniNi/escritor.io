/**
 * Aritmética de data pura pro módulo de escala inteiro (mês/semana/dia + escala da equipe) -
 * `Date.UTC`/`getUTC*` em vez de construtor/getters locais, mesma disciplina de
 * `limitesDoDiaUtc.ts` e `construirGradeDoMes.ts`: evita qualquer desvio de fuso horário na
 * aritmética de data pura (uma data sem hora não deve depender do fuso do navegador).
 */

function comZero(numero: number, digitos: number): string {
  return String(numero).padStart(digitos, '0')
}

export function formatarDataIso(data: Date): string {
  return `${comZero(data.getUTCFullYear(), 4)}-${comZero(data.getUTCMonth() + 1, 2)}-${comZero(data.getUTCDate(), 2)}`
}

/** Segunda-feira da semana que contém a data (ano/mês 1-12/dia). */
export function segundaFeiraDaSemana(ano: number, mes: number, dia: number): string {
  const diaDaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay() // 0=domingo..6=sábado
  const deslocamentoAteASegunda = diaDaSemana === 0 ? -6 : 1 - diaDaSemana
  return formatarDataIso(new Date(Date.UTC(ano, mes - 1, dia + deslocamentoAteASegunda)))
}

export function somarDias(dataIso: string, quantidade: number): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number)
  return formatarDataIso(new Date(Date.UTC(ano, mes - 1, dia + quantidade)))
}

/** "AAAA-MM-DD" de hoje, na mesma convenção UTC-pura do resto do módulo. */
export function dataDeHoje(): string {
  const agora = new Date()
  return formatarDataIso(new Date(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate())))
}

export function anoDaData(dataIso: string): number {
  return Number(dataIso.slice(0, 4))
}

export function mesDaData(dataIso: string): number {
  return Number(dataIso.slice(5, 7))
}

export function diaDaData(dataIso: string): number {
  return Number(dataIso.slice(8, 10))
}

const NOMES_DIA_DA_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const ABREVIACOES_DIA_DA_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export function nomeDoDiaDaSemana(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number)
  return NOMES_DIA_DA_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()]
}

/**
 * Abreviação (Seg/Ter/.../Dom) calculada a partir do dia da semana real da data - não pode vir só
 * do índice dentro de um array de dias (bug real pego na verificação visual: `CalendarioDia`
 * reusa `CalendarioSemana` com um array de 1 dia só, então o índice 0 sempre dava "Seg" nele,
 * mesmo num sábado).
 */
export function abreviacaoDoDiaDaSemana(dataIso: string): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number)
  return ABREVIACOES_DIA_DA_SEMANA[new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()]
}
