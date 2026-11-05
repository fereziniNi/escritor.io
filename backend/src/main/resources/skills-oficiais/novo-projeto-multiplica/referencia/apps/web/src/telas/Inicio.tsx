// origem: skills-modelo/apps/web/src/telas/Inicio.tsx
import { useQuery } from '@tanstack/react-query';
import { buscarSaude } from '@/lib/api';

/** Tela inicial do esqueleto: mostra se a API e o banco respondem e qual versão está no ar. */
export function Inicio() {
  // TanStack Query v5: sempre a forma de objeto; a chave identifica o dado no cache.
  const saude = useQuery({ queryKey: ['saude'], queryFn: buscarSaude });

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">Sistema Multiplica</h1>
      {saude.isPending && <p className="mt-4 text-sm text-muted-foreground">Verificando a API…</p>}
      {saude.isError && (
        <p role="alert" className="mt-4 rounded-md border border-destructive p-3 text-sm text-destructive">
          API indisponível
        </p>
      )}
      {saude.data && (
        <ul className="mt-4 space-y-1 text-sm">
          <li>API no ar</li>
          <li>{saude.data.banco === 'ok' ? 'Banco ok' : 'Banco fora do ar'}</li>
          <li className="font-mono text-muted-foreground">
            versão {saude.data.versao} ({saude.data.commit})
          </li>
        </ul>
      )}
    </main>
  );
}
