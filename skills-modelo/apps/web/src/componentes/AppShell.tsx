import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { AlternarTema } from '@/componentes/AlternarTema';
import { cn } from '@/lib/utils';

export interface ItemMenu {
  rotulo: string;
  para: string;
  icone?: ReactNode;
}
export interface GrupoMenu {
  titulo?: string;
  itens: ItemMenu[];
}

interface Props {
  /** Nome do sistema na marca: "Beyond" + nome em ciano. */
  nomeSistema: string;
  grupos: GrupoMenu[];
  usuario?: { nome: string; papel?: string };
  /** Versão mostrada no rodapé como v{versao} (vem de /api/health). */
  versao?: string;
  /** Mostra o botão "Sair" no rodapé da sidebar (a skill de login liga ao POST /api/auth/sair). */
  aoSair?: () => void;
  children: ReactNode;
}

/** Estrutura das telas logadas: sidebar navy de 256px (marca, grupos, rodapé) + área de conteúdo. */
export function AppShell({ nomeSistema, grupos, usuario, versao, aoSair, children }: Props) {
  return (
    <div className="flex min-h-screen bg-fundo text-texto">
      <aside className="sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-navy px-2.5 py-4 text-navy-texto">
        <div role="img" aria-label={`Beyond ${nomeSistema}, Multiplica`} className="px-2">
          <div className="font-display text-[17px] font-bold leading-tight text-white" aria-hidden="true">
            Beyond<span className="text-ciano">{nomeSistema}</span>
          </div>
          <div className="pb-3.5 text-[10px] tracking-[0.14em] opacity-70" aria-hidden="true">
            MULTIPLICA
          </div>
        </div>
        <nav aria-label="Principal" className="flex-1 overflow-y-auto">
          {grupos.map((grupo, i) => (
            <div key={grupo.titulo ?? i}>
              {grupo.titulo && (
                <div className="px-2 pb-1 pt-2.5 text-xs font-medium uppercase tracking-wider opacity-60">{grupo.titulo}</div>
              )}
              <ul className="flex flex-col gap-0.5">
                {grupo.itens.map((item) => (
                  <li key={item.para}>
                    <NavLink
                      to={item.para}
                      end={item.para === '/'}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-2 rounded-md px-2.5 py-[7px] text-13 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ciano',
                          isActive
                            ? 'bg-primaria text-sobre-primaria shadow-[inset_3px_0_0_var(--ciano)]'
                            : 'hover:bg-navy-hover',
                        )
                      }
                    >
                      {item.icone}
                      {item.rotulo}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="flex items-center gap-2 border-t border-navy-hover px-2 pt-3">
          <div className="min-w-0 flex-1 text-xs">
            {usuario && (
              <>
                <div className="truncate font-medium text-white">{usuario.nome}</div>
                {usuario.papel && <div className="truncate opacity-70">{usuario.papel}</div>}
              </>
            )}
            {versao && <div className="font-mono opacity-60">{`v${versao}`}</div>}
          </div>
          <AlternarTema className="text-navy-texto hover:bg-navy-hover hover:text-white focus-visible:border-ciano focus-visible:ring-2 focus-visible:ring-ciano" />
          {aoSair && (
            <button
              type="button"
              onClick={aoSair}
              aria-label="Sair"
              title="Sair"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-navy-texto outline-none transition-colors hover:bg-navy-hover hover:text-white focus-visible:ring-2 focus-visible:ring-ciano"
            >
              <LogOut className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
