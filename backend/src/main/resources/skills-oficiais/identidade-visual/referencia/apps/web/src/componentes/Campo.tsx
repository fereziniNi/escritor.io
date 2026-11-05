// origem: skills-modelo/apps/web/src/componentes/Campo.tsx
import type { ComponentProps } from 'react';
import { useId } from 'react';
import { cn } from '@/lib/utils';

/** Classes de campo de texto ou seleção (use em <input> e <select> avulsos). */
export const classeCampo =
  'h-9 w-full rounded-md border border-input bg-superficie px-3 text-sm text-texto placeholder:text-texto-3 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-perigo disabled:opacity-50';

/** Rótulo + campo + mensagem de erro, ligados por id (acessível). */
export function Campo({ rotulo, erro, className, ...props }: { rotulo: string; erro?: string | undefined } & ComponentProps<'input'>) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-texto-2">
        {rotulo}
      </label>
      <input
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${id}-erro` : undefined}
        className={cn(classeCampo, className)}
        {...props}
      />
      {erro && (
        <p id={`${id}-erro`} className="text-xs text-perigo">
          {erro}
        </p>
      )}
    </div>
  );
}
