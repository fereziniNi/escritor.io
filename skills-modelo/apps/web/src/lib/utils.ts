import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Junta classes do Tailwind resolvendo conflitos (padrão do shadcn/ui). */
export function cn(...classes: ClassValue[]) {
  return twMerge(clsx(classes));
}
