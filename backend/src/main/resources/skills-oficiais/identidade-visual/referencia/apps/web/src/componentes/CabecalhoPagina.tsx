// origem: skills-modelo/apps/web/src/componentes/CabecalhoPagina.tsx
import type { ReactNode } from 'react';

/** Título da tela (h1 em Space Grotesk), descrição curta e ações à direita. */
export function CabecalhoPagina({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: ReactNode }) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-display text-xl font-semibold text-texto">{titulo}</h1>
        {descricao && <p className="text-13 text-texto-2">{descricao}</p>}
      </div>
      {acoes && <div className="flex items-center gap-2">{acoes}</div>}
    </header>
  );
}
