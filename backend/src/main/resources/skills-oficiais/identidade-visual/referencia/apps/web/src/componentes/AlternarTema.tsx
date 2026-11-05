// origem: skills-modelo/apps/web/src/componentes/AlternarTema.tsx
import { Moon, Sun } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/componentes/ui/button';
import { type Tema, alternarTema, temaEfetivo } from '@/tema/tema';

/** Botão claro/escuro. A escolha fica salva (multiplica:tema) e vale na próxima visita. */
export function AlternarTema({ className }: { className?: string }) {
  const [tema, setTema] = useState<Tema>(() => temaEfetivo());
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      aria-label={tema === 'escuro' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'}
      onClick={() => setTema(alternarTema())}
    >
      {tema === 'escuro' ? <Sun /> : <Moon />}
    </Button>
  );
}
