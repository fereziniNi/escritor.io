// origem: skills-modelo/apps/web/src/telas/modelo/TelaListagem.tsx
import { useId, useState } from 'react';
import { CabecalhoPagina } from '@/componentes/CabecalhoPagina';
import { Campo, classeCampo } from '@/componentes/Campo';
import { Cartao } from '@/componentes/Cartao';
import { EstadoVazio } from '@/componentes/estados';
import { Selo, type TomSelo } from '@/componentes/Selo';
import { Button } from '@/componentes/ui/button';
import { formatarData, formatarMoeda } from '@/lib/formatos';

interface Linha {
  id: number;
  nome: string;
  limite: number;
  status: 'Aprovado' | 'Em comitê' | 'Recusado';
  criadoEm: string;
}

const tomPorStatus: Record<Linha['status'], TomSelo> = { Aprovado: 'sucesso', 'Em comitê': 'alerta', Recusado: 'perigo' };

// Dados de exemplo: na tela real vêm de useQuery (com Carregando e ErroCarregar de componentes/estados).
const linhasExemplo: Linha[] = [
  { id: 1, nome: 'Alfa Ltda', limite: 500000, status: 'Aprovado', criadoEm: '2026-10-02' },
  { id: 2, nome: 'Beta S.A.', limite: 1200000, status: 'Em comitê', criadoEm: '2026-10-21' },
  { id: 3, nome: 'Gama ME', limite: 80000, status: 'Recusado', criadoEm: '2026-11-03' },
];

/** Listagem padrão: cabeçalho com ação, filtros acima e tabela densa (13px) com valores em mono. */
export function TelaListagem({ linhas = linhasExemplo }: { linhas?: Linha[] }) {
  const [busca, setBusca] = useState('');
  const [status, setStatus] = useState('');
  const idStatus = useId();

  const filtradas = linhas.filter(
    (l) => l.nome.toLowerCase().includes(busca.trim().toLowerCase()) && (status === '' || l.status === status),
  );

  return (
    <div>
      <CabecalhoPagina titulo="Cedentes" descricao="Empresas cadastradas" acoes={<Button>Novo cedente</Button>} />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <Campo rotulo="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Nome do cedente" />
        </div>
        <div className="flex w-48 flex-col gap-1">
          <label htmlFor={idStatus} className="text-xs font-medium text-texto-2">
            Status
          </label>
          <select id={idStatus} className={classeCampo} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option>
            <option value="Aprovado">Aprovado</option>
            <option value="Em comitê">Em comitê</option>
            <option value="Recusado">Recusado</option>
          </select>
        </div>
      </div>
      <Cartao className="overflow-hidden p-0">
        {filtradas.length === 0 ? (
          <EstadoVazio titulo="Nenhum resultado" descricao="Ajuste a busca ou os filtros." />
        ) : (
          <table className="w-full border-collapse text-13">
            <thead>
              <tr className="border-b border-borda text-left text-xs text-texto-2">
                <th className="px-3 py-2 font-semibold">Cedente</th>
                <th className="px-3 py-2 font-semibold">Limite</th>
                <th className="px-3 py-2 font-semibold">Cadastro</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((l) => (
                <tr key={l.id} className="border-b border-borda last:border-0">
                  <td className="px-3 py-2">{l.nome}</td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono tabular-nums">{formatarMoeda(l.limite)}</td>
                  <td className="px-3 py-2 font-mono tabular-nums">{formatarData(l.criadoEm)}</td>
                  <td className="px-3 py-2">
                    <Selo tom={tomPorStatus[l.status]}>{l.status}</Selo>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Cartao>
    </div>
  );
}
