// origem: skills-modelo/apps/web/src/telas/TelaAuditoria.tsx
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import { ACOES_CONHECIDAS, type EventoAuditoria } from 'contratos';
import { type FormEvent, useState } from 'react';
import { CabecalhoPagina } from '@/componentes/CabecalhoPagina';
import { Campo, classeCampo } from '@/componentes/Campo';
import { Cartao } from '@/componentes/Cartao';
import { Carregando, ErroCarregar, EstadoVazio } from '@/componentes/estados';
import { Button } from '@/componentes/ui/button';
import { baixarCsv, type FiltrosAuditoria, listarEventos } from '@/lib/auditoria-api';
import { listarUsuarios } from '@/lib/usuarios-api';

const dataHoraBrasilia = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

/** "05/11/2026 12:30:00" no horário de Brasília. */
function formatarDataHora(iso: string): string {
  const partes = Object.fromEntries(dataHoraBrasilia.formatToParts(new Date(iso)).map((p) => [p.type, p.value]));
  return `${partes['day']}/${partes['month']}/${partes['year']} ${partes['hour']}:${partes['minute']}:${partes['second']}`;
}

const json = (valor: unknown) => JSON.stringify(valor, null, 2);

function Detalhes({ e }: { e: EventoAuditoria }) {
  const temAntes = e.antes !== null && e.antes !== undefined;
  const temDepois = e.depois !== null && e.depois !== undefined;
  return (
    <details>
      <summary className="cursor-pointer text-primaria">Detalhes</summary>
      <dl className="mt-2 grid max-w-xl grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        {temAntes && (
          <>
            <dt className="text-texto-2">Antes</dt>
            <dd>
              <pre className="whitespace-pre-wrap break-all font-mono">{json(e.antes)}</pre>
            </dd>
          </>
        )}
        {temDepois && (
          <>
            <dt className="text-texto-2">Depois</dt>
            <dd>
              <pre className="whitespace-pre-wrap break-all font-mono">{json(e.depois)}</pre>
            </dd>
          </>
        )}
        <dt className="text-texto-2">Request-id</dt>
        <dd className="font-mono">{e.requestId ?? '—'}</dd>
        <dt className="text-texto-2">Evento</dt>
        <dd className="font-mono">{e.id}</dd>
      </dl>
    </details>
  );
}

/**
 * Trilha de auditoria (só ADMIN; a API recusa os outros com 403). Somente leitura: filtra por período, ator e ação,
 * pagina e exporta CSV. Não existe editar nem apagar evento.
 */
export function TelaAuditoria() {
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [atorId, setAtorId] = useState('');
  const [acao, setAcao] = useState('');
  const [aplicados, setAplicados] = useState<FiltrosAuditoria>({});
  const [aviso, setAviso] = useState<string | null>(null);

  const usuarios = useQuery({ queryKey: ['usuarios'], queryFn: listarUsuarios });
  const lista = useInfiniteQuery({
    queryKey: ['auditoria', aplicados],
    queryFn: ({ pageParam }) => listarEventos(aplicados, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (ultima) => ultima.proximoCursor ?? undefined,
  });
  const exportar = useMutation({
    mutationFn: () => baixarCsv(aplicados),
    onSuccess: ({ blob, nomeArquivo, truncado }) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = nomeArquivo;
      link.click();
      URL.revokeObjectURL(url);
      setAviso(truncado ? 'A exportação foi cortada em 10.000 linhas. Restrinja o período ou os filtros para ver o resto.' : `Arquivo ${nomeArquivo} gerado.`);
    },
  });

  function filtrar(e: FormEvent) {
    e.preventDefault();
    setAviso(null);
    setAplicados({ de, ate, atorId, acao });
  }

  function limpar() {
    setDe('');
    setAte('');
    setAtorId('');
    setAcao('');
    setAviso(null);
    setAplicados({});
  }

  const eventos = lista.data?.pages.flatMap((p) => p.itens) ?? [];
  const erro = exportar.error;

  return (
    <div>
      <CabecalhoPagina
        titulo="Auditoria"
        descricao="Quem fez o quê e quando. Os registros não podem ser alterados nem apagados."
        acoes={
          <Button type="button" variant="outline" disabled={exportar.isPending} onClick={() => exportar.mutate()}>
            Exportar CSV
          </Button>
        }
      />

      <Cartao titulo="Filtros" className="mb-4">
        <form onSubmit={filtrar} className="flex flex-wrap items-end gap-3">
          <div className="w-40">
            <Campo rotulo="De" type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </div>
          <div className="w-40">
            <Campo rotulo="Até" type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </div>
          <div className="flex w-64 flex-col gap-1">
            <label htmlFor="auditoria-ator" className="text-xs font-medium text-texto-2">
              Ator
            </label>
            <select id="auditoria-ator" className={classeCampo} value={atorId} onChange={(e) => setAtorId(e.target.value)}>
              <option value="">Todos</option>
              {usuarios.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div className="w-56">
            <Campo rotulo="Ação" list="auditoria-acoes" value={acao} onChange={(e) => setAcao(e.target.value)} placeholder="ex.: usuario.desativar" />
            <datalist id="auditoria-acoes">
              {ACOES_CONHECIDAS.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          </div>
          <Button type="submit">Filtrar</Button>
          <Button type="button" variant="outline" onClick={limpar}>
            Limpar
          </Button>
        </form>
      </Cartao>

      {aviso && (
        <p role="status" className="mb-3 rounded-md bg-sucesso-suave px-3 py-2 text-13 text-sucesso">
          {aviso}
        </p>
      )}
      {erro && (
        <p role="alert" className="mb-3 rounded-md bg-perigo-suave px-3 py-2 text-13 text-perigo">
          {erro.message}
        </p>
      )}

      <Cartao className="overflow-hidden p-0">
        {lista.isPending ? (
          <Carregando texto="Carregando eventos…" />
        ) : lista.isError ? (
          <ErroCarregar mensagem={lista.error.message} aoTentarDeNovo={() => void lista.refetch()} />
        ) : eventos.length === 0 ? (
          <EstadoVazio titulo="Nenhum evento" descricao="Nada na trilha com estes filtros." />
        ) : (
          <>
            <table className="w-full border-collapse text-13">
              <thead>
                <tr className="border-b border-borda text-left text-xs text-texto-2">
                  <th className="px-3 py-2 font-semibold">Data e hora</th>
                  <th className="px-3 py-2 font-semibold">Ator</th>
                  <th className="px-3 py-2 font-semibold">Ação</th>
                  <th className="px-3 py-2 font-semibold">Alvo</th>
                  <th className="px-3 py-2 font-semibold">IP</th>
                  <th className="px-3 py-2 font-semibold">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {eventos.map((e) => (
                  <tr key={e.id} className="border-b border-borda align-top last:border-0">
                    <td className="px-3 py-2 font-mono tabular-nums">{formatarDataHora(e.ocorridoEm)}</td>
                    <td className="px-3 py-2">{e.atorEmail ?? (e.atorId ? e.atorId : 'Sistema ou não identificado')}</td>
                    <td className="px-3 py-2 font-mono">{e.acao}</td>
                    <td className="px-3 py-2 font-mono">{e.alvoTipo ? `${e.alvoTipo} ${e.alvoId ?? ''}`.trim() : '—'}</td>
                    <td className="px-3 py-2 font-mono">{e.ip ?? '—'}</td>
                    <td className="px-3 py-2">
                      <Detalhes e={e} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lista.hasNextPage && (
              <div className="flex justify-center border-t border-borda p-3">
                <Button type="button" variant="outline" disabled={lista.isFetchingNextPage} onClick={() => void lista.fetchNextPage()}>
                  Carregar mais
                </Button>
              </div>
            )}
          </>
        )}
      </Cartao>
    </div>
  );
}
