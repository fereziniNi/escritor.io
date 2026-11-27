import { CabecalhoPagina } from '@/componentes/CabecalhoPagina';
import { Cartao } from '@/componentes/Cartao';
import { GraficoBarras } from '@/componentes/GraficoBarras';
import { Selo, type TomSelo } from '@/componentes/Selo';
import { Button } from '@/componentes/ui/button';

const indicadores: { rotulo: string; valor: string; selo: string; tom: TomSelo }[] = [
  { rotulo: 'Em análise', valor: '42', selo: '+6 hoje', tom: 'info' },
  { rotulo: 'Aprovados', valor: '128', selo: '87%', tom: 'sucesso' },
  { rotulo: 'Pendências', valor: '7', selo: 'atenção', tom: 'alerta' },
];

const operacoesPorMes = [
  { rotulo: 'Jul', valor: 31 },
  { rotulo: 'Ago', valor: 44 },
  { rotulo: 'Set', valor: 38 },
  { rotulo: 'Out', valor: 52 },
  { rotulo: 'Nov', valor: 47 },
];

/** Painel padrão: indicadores em cartões (número grande em Space Grotesk) e um gráfico. Dados de exemplo. */
export function TelaPainel() {
  return (
    <div>
      <CabecalhoPagina titulo="Painel" descricao="Visão geral da carteira" acoes={<Button variant="outline">Exportar</Button>} />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        {indicadores.map((i) => (
          <Cartao key={i.rotulo}>
            <div className="text-xs font-medium text-texto-2">{i.rotulo}</div>
            <div className="font-display text-2xl font-semibold tabular-nums">{i.valor}</div>
            <Selo tom={i.tom}>{i.selo}</Selo>
          </Cartao>
        ))}
      </div>
      <Cartao titulo="Operações por mês">
        <GraficoBarras titulo="Operações por mês" dados={operacoesPorMes} />
      </Cartao>
    </div>
  );
}
