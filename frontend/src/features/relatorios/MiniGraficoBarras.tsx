import './relatorios.css'

interface MiniGraficoBarrasProps {
  /** Sempre 24 posições - índice = hora do dia (0-23). */
  valores: number[]
  /** Formata o valor de uma barra pro tooltip (`title`) - "45min" ou "3 reuniões", por exemplo -
   * quem chama decide a unidade, este componente só desenha. */
  formatarValor: (valor: number) => string
}

/**
 * Histograma de 24 barras CSS puro (sem lib de gráfico nova - mesmo espírito "sem dependência
 * pesada" já usado no resto do projeto) - reaproveitado pros dois histogramas de hora do dia
 * (horário que mais trabalhou / horário preferido de reuniões).
 */
export function MiniGraficoBarras({ valores, formatarValor }: MiniGraficoBarrasProps) {
  const maximo = Math.max(1, ...valores)

  return (
    <div className="mini-grafico-barras" role="img" aria-label="Distribuição por hora do dia">
      {valores.map((valor, hora) => (
        <div key={hora} className="mini-grafico-barra-coluna" title={`${hora}h: ${formatarValor(valor)}`}>
          <div className="mini-grafico-barra" style={{ height: `${(valor / maximo) * 100}%` }} />
          {hora % 3 === 0 && <span className="mini-grafico-barra-rotulo">{hora}h</span>}
        </div>
      ))}
    </div>
  )
}
