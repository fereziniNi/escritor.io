import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/componentes/ui/button';

/** Lista ou busca sem resultado: diz o que aconteceu e oferece o próximo passo. */
export function EstadoVazio({ titulo, descricao, acao }: { titulo: string; descricao?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <Inbox className="size-8 text-texto-3" aria-hidden="true" />
      <p className="font-display text-base font-semibold">{titulo}</p>
      {descricao && <p className="max-w-sm text-13 text-texto-2">{descricao}</p>}
      {acao}
    </div>
  );
}

/** Enquanto a consulta não responde. */
export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 px-4 py-10 text-13 text-texto-2">
      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      {texto}
    </div>
  );
}

/** Falha ao buscar dados: mensagem clara e "Tentar de novo". */
export function ErroCarregar({ mensagem, aoTentarDeNovo }: { mensagem: string; aoTentarDeNovo?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <AlertTriangle className="size-8 text-perigo" aria-hidden="true" />
      <p className="text-sm text-perigo">{mensagem}</p>
      {aoTentarDeNovo && (
        <Button type="button" variant="outline" size="sm" onClick={aoTentarDeNovo}>
          Tentar de novo
        </Button>
      )}
    </div>
  );
}
