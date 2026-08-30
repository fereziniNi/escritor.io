import { useMutation, useQuery } from '@tanstack/react-query'
import { baixarEspelhoDoMesCsv, buscarEspelhoDoMes } from './api'
import { formatarEstado, formatarMinutos, formatarSaldo } from './formatarMinutos'

/**
 * Um `<a href>` puro não carrega o header `Authorization` numa navegação normal do navegador
 * (S5.9) - por isso o CSV é buscado via `apiFetch` (que já anexa o token) como `Blob`, e o
 * download é disparado programaticamente com um link temporário apontando pro `Blob` em memória.
 */
function dispararDownload(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  link.click()
  URL.revokeObjectURL(url)
}

export function EspelhoMesPainel() {
  const espelhoQuery = useQuery({ queryKey: ['ponto', 'espelho-do-mes'], queryFn: () => buscarEspelhoDoMes() })

  const exportarCsvMutation = useMutation({
    mutationFn: () => baixarEspelhoDoMesCsv(),
    onSuccess: (blob) => dispararDownload(blob, 'espelho-do-mes.csv'),
  })

  if (espelhoQuery.isPending) {
    return <p className="mensagem-carregando">Carregando…</p>
  }

  if (espelhoQuery.isError) {
    return <p className="mensagem-erro">Não foi possível carregar o espelho do mês.</p>
  }

  const espelho = espelhoQuery.data

  return (
    <section className="secao cartao">
      <h2 className="secao-titulo">🗓️ Espelho do mês</h2>
      {espelho.dias.length === 0 && <p className="mensagem-vazia">Nenhuma marcação neste mês.</p>}
      {espelho.dias.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="tabela-elegante">
            <thead>
              <tr>
                <th>Data</th>
                <th>Estado</th>
                <th>Trabalhado</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {espelho.dias.map((dia) => (
                <tr key={dia.data}>
                  <td>{dia.data}</td>
                  <td>{formatarEstado(dia.estado)}</td>
                  <td>{formatarMinutos(dia.minutosTrabalhados)}</td>
                  <td>{formatarSaldo(dia.saldoDia)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p>Saldo acumulado no período: {formatarSaldo(espelho.saldoAcumuladoNoPeriodo)}</p>
      <div className="linha-botoes">
        <button type="button" onClick={() => exportarCsvMutation.mutate()} disabled={exportarCsvMutation.isPending}>
          ⬇️ Exportar CSV
        </button>
      </div>
      {exportarCsvMutation.isError && <p className="mensagem-erro">Não foi possível exportar o espelho do mês.</p>}
    </section>
  )
}
