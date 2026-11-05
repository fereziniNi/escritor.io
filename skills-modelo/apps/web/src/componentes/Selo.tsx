import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const tons = {
  sucesso: 'bg-sucesso-suave text-sucesso',
  alerta: 'bg-alerta-suave text-alerta',
  perigo: 'bg-perigo-suave text-perigo',
  info: 'bg-info-suave text-info',
} as const;

export type TomSelo = keyof typeof tons;

/** Selo de status (badge): sempre um dos quatro tons semânticos. */
export function Selo({ tom, children }: { tom: TomSelo; children: ReactNode }) {
  return <span className={cn('inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold', tons[tom])}>{children}</span>;
}
