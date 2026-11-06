// origem: skills-modelo/apps/web/src/componentes/BotaoExportar.tsx
import { useMutation } from '@tanstack/react-query';
import { ChevronDown, Download } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/componentes/ui/button';
import { baixarExportacao, type FormatoExportacao, salvarArquivo } from '@/lib/exportar-api';

const ROTULOS: Record<FormatoExportacao, string> = { xlsx: 'Excel (.xlsx)', pdf: 'PDF', csv: 'CSV' };

interface Props {
  /** Rota da API que exporta, ex.: `/api/clientes/exportar` (recebe `?formato=xlsx|pdf|csv`). */
  url: string;
  /** Outros parâmetros da consulta (filtros da tela). */
  parametros?: Record<string, string>;
  formatos?: FormatoExportacao[];
  rotulo?: string;
}

/**
 * Botão "Exportar" padrão: menu com Excel, PDF e CSV, baixa o arquivo e avisa se a API cortou no limite de linhas. O
 * conteúdo (e a máscara de CPF/e-mail por papel) vem pronto da API: o botão só pede e entrega o arquivo.
 */
export function BotaoExportar({ url, parametros = {}, formatos = ['xlsx', 'pdf', 'csv'], rotulo = 'Exportar' }: Props) {
  const [aberto, setAberto] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const raiz = useRef<HTMLDivElement>(null);

  const exportar = useMutation({
    mutationFn: (formato: FormatoExportacao) => baixarExportacao(url, formato, parametros),
    onMutate: () => {
      setAviso(null);
      setAberto(false);
    },
    onSuccess: (arquivo) => {
      salvarArquivo(arquivo);
      setAviso(
        arquivo.truncado
          ? `O arquivo ${arquivo.nomeArquivo} foi cortado no limite de linhas. Restrinja os filtros para ver o resto.`
          : `Arquivo ${arquivo.nomeArquivo} gerado.`,
      );
    },
  });

  // Fecha o menu com Esc ou clicando fora.
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (!raiz.current?.contains(e.target as Node)) setAberto(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  return (
    <div ref={raiz} className="relative inline-flex flex-col items-end gap-1">
      <Button type="button" variant="outline" disabled={exportar.isPending} aria-haspopup="menu" aria-expanded={aberto} onClick={() => setAberto((v) => !v)}>
        <Download aria-hidden="true" />
        {rotulo}
        <ChevronDown aria-hidden="true" />
      </Button>
      {aberto && (
        <div role="menu" className="absolute top-full right-0 z-10 mt-1 min-w-40 rounded-md border border-borda bg-superficie p-1 shadow-md">
          {formatos.map((f) => (
            <button
              key={f}
              type="button"
              role="menuitem"
              className="block w-full rounded px-3 py-2 text-left text-sm text-texto hover:bg-primaria-suave"
              onClick={() => exportar.mutate(f)}
            >
              {ROTULOS[f]}
            </button>
          ))}
        </div>
      )}
      {exportar.isError && (
        <p role="alert" className="text-13 text-perigo">
          {exportar.error.message}
        </p>
      )}
      {aviso && !exportar.isError && (
        <p role="status" className="text-13 text-texto-2">
          {aviso}
        </p>
      )}
    </div>
  );
}
