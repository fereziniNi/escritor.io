import { hojeNaEmpresa } from '../../shared/fusoEmpresa'

/**
 * A hora (0-23) com o maior valor do histograma - "horário que mais trabalhou"/"horário
 * preferido de reuniões" (pedido do usuário). `null` quando tudo é zero (sem dado nenhum no
 * período) - função pura, testada isolada do componente que a usa.
 */
export function horaDePico(valores: number[]): number | null {
  let indiceDoPico = -1
  let maiorValor = 0
  valores.forEach((valor, hora) => {
    if (valor > maiorValor) {
      maiorValor = valor
      indiceDoPico = hora
    }
  })
  return indiceDoPico === -1 ? null : indiceDoPico
}

/** "14h-15h" - a faixa de uma hora inteira a partir do pico, formato consistente com o resto do
 * app (sempre "9h", nunca "09:00"). */
export function formatarFaixaDeHora(hora: number): string {
  return `${hora}h-${(hora + 1) % 24}h`
}

/**
 * Pedido do usuário: "quero trazer as informações que eu pedi, sem usar o filtro" - início/fim já
 * vêm preenchidos (mês corrente até hoje) em vez de exigir que a pessoa digite datas pra ver
 * alguma coisa; o filtro continua existindo pra quem quiser outro período.
 *
 * `fim` é o dia SEGUINTE a hoje, não hoje - o resto do sistema trata `fim` como exclusivo (a API
 * é chamada com a meia-noite de `fim`, ver `RelatoriosPage`), então sem isso o próprio dia de hoje
 * ficaria de fora de um período que deveria ir "até hoje". "Hoje" é o dia no fuso da empresa
 * (`hojeNaEmpresa`), igual ao backend.
 */
export function periodoPadrao(agora: Date): { inicio: string; fim: string } {
  const [ano, numeroDoMes, dia] = hojeNaEmpresa(agora).split('-').map(Number)
  const mes = numeroDoMes - 1
  const inicioDoMes = new Date(Date.UTC(ano, mes, 1))
  const amanha = new Date(Date.UTC(ano, mes, dia + 1))
  return { inicio: inicioDoMes.toISOString().slice(0, 10), fim: amanha.toISOString().slice(0, 10) }
}

/**
 * Início/fim (fim exclusivo, mesma convenção de `periodoPadrao`) de um mês inteiro, a partir do
 * valor de um `<input type="month">` (AAAA-MM) - base do seletor "Mês" de `RelatoriosPage`, que
 * deixa ver as estatísticas de qualquer mês, não só o corrente.
 */
export function periodoDoMes(mes: string): { inicio: string; fim: string } {
  const [ano, numeroDoMes] = mes.split('-').map(Number)
  const inicio = new Date(Date.UTC(ano, numeroDoMes - 1, 1))
  const proximoMes = new Date(Date.UTC(ano, numeroDoMes, 1))
  return { inicio: inicio.toISOString().slice(0, 10), fim: proximoMes.toISOString().slice(0, 10) }
}
