// origem: skills-modelo/apps/web/src/componentes/Cartao.tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Cartão padrão: superfície, borda e raio de 12px. */
export function Cartao({ titulo, children, className }: { titulo?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-lg border border-borda bg-superficie p-4', className)}>
      {titulo && <h2 className="mb-2 font-display text-base font-semibold">{titulo}</h2>}
      {children}
    </section>
  );
}
