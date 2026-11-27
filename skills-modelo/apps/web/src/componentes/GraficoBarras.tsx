export interface PontoGrafico {
  rotulo: string;
  valor: number;
}

/** Gráfico de barras simples, sem biblioteca, só com tokens. Para gráficos ricos use recharts com as mesmas cores. */
export function GraficoBarras({ titulo, dados }: { titulo: string; dados: PontoGrafico[] }) {
  const maximo = Math.max(1, ...dados.map((d) => d.valor));
  return (
    <div role="img" aria-label={`${titulo}: ${dados.map((d) => `${d.rotulo} ${d.valor}`).join(', ')}`} className="flex h-40 items-end gap-3">
      {dados.map((d) => (
        <div key={d.rotulo} className="flex h-full flex-1 flex-col justify-end gap-1" aria-hidden="true">
          <span className="text-center font-mono text-xs text-texto-2">{d.valor}</span>
          <div className="rounded-t-sm bg-primaria" style={{ height: `${(d.valor / maximo) * 100}%` }} />
          <span className="text-center text-xs text-texto-3">{d.rotulo}</span>
        </div>
      ))}
    </div>
  );
}
