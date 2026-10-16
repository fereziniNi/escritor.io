import { hojeNaEmpresa, inicioDoDiaNaEmpresa } from '../../shared/fusoEmpresa'

/**
 * Início/fim do dia civil no fuso da empresa (mesma convenção do backend, ver `ClockConfig`) -
 * usado pra pedir o tempo apontado em cada tarefa só de hoje (`listarTotalApontadoPorCard`).
 * Recebe `agora` em vez de chamar `new Date()` sozinho, mesmo espírito de `Clock` injetado no
 * backend - deixa a função pura e testável.
 */
export function calcularLimitesDoDia(agora: Date): { inicio: string; fim: string } {
  const hoje = hojeNaEmpresa(agora)
  const [ano, mes, dia] = hoje.split('-').map(Number)
  const amanha = new Date(Date.UTC(ano, mes - 1, dia + 1)).toISOString().slice(0, 10)
  return { inicio: inicioDoDiaNaEmpresa(hoje), fim: inicioDoDiaNaEmpresa(amanha) }
}
