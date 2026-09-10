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
 * é chamada com `${fim}T00:00:00Z`, ver `RelatoriosPage`), então sem isso o próprio dia de hoje
 * ficaria de fora de um período que deveria ir "até hoje". Data civil em UTC, mesma convenção do
 * resto do app (sem fuso horário da empresa ainda, ver ADR 0010).
 */
export function periodoPadrao(agora: Date): { inicio: string; fim: string } {
  const ano = agora.getUTCFullYear()
  const mes = agora.getUTCMonth()
  const inicioDoMes = new Date(Date.UTC(ano, mes, 1))
  const amanha = new Date(Date.UTC(ano, mes, agora.getUTCDate() + 1))
  return { inicio: inicioDoMes.toISOString().slice(0, 10), fim: amanha.toISOString().slice(0, 10) }
}
