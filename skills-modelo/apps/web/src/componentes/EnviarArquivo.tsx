import { useMutation } from '@tanstack/react-query';
import { Upload } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/componentes/ui/button';
import { classeCampo } from '@/componentes/Campo';
import { ACEITAR, type ArquivoEnviado, enviarArquivo, type EscopoArquivo } from '@/lib/arquivos-api';

interface Props {
  /** Tamanho máximo mostrado e conferido antes de enviar; tem de ser o UPLOAD_MAX_MB da API (a API confere de novo). */
  maxMb?: number;
  /** Chamado com o arquivo criado (ex.: para recarregar a lista). */
  onEnviado?: (arquivo: ArquivoEnviado) => void;
}

/**
 * Envio de arquivo padrão: escolhe o arquivo (PDF, PNG, JPEG, XLSX), diz quem pode ver, envia e mostra o resultado. O limite
 * de tamanho aqui é só para poupar a viagem; o tipo e o tamanho de verdade são conferidos pela API.
 */
export function EnviarArquivo({ maxMb = 10, onEnviado }: Props) {
  const idArquivo = useId();
  const idEscopo = useId();
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [escopo, setEscopo] = useState<EscopoArquivo>('PRIVADO');
  const [aviso, setAviso] = useState<string | null>(null);
  const grandeDemais = arquivo !== null && arquivo.size > maxMb * 1024 * 1024;

  const enviar = useMutation({
    mutationFn: (a: File) => enviarArquivo(a, escopo),
    onMutate: () => setAviso(null),
    onSuccess: (criado) => {
      setAviso(`Arquivo ${criado.nome} enviado.`);
      setArquivo(null);
      onEnviado?.(criado);
    },
  });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (arquivo && !grandeDemais) enviar.mutate(arquivo);
      }}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={idArquivo} className="text-xs font-medium text-texto-2">
          Arquivo
        </label>
        <input
          id={idArquivo}
          type="file"
          accept={ACEITAR}
          className={classeCampo}
          onChange={(e) => {
            setArquivo(e.target.files?.[0] ?? null);
            setAviso(null);
            enviar.reset();
          }}
        />
        <p className="text-xs text-texto-3">PDF, PNG, JPEG ou Excel (.xlsx), até {maxMb} MB.</p>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={idEscopo} className="text-xs font-medium text-texto-2">
          Quem pode ver
        </label>
        <select id={idEscopo} className={classeCampo} value={escopo} onChange={(e) => setEscopo(e.target.value as EscopoArquivo)}>
          <option value="PRIVADO">Só eu</option>
          <option value="GESTAO">Eu e os gestores</option>
        </select>
      </div>
      <div>
        <Button type="submit" disabled={!arquivo || grandeDemais || enviar.isPending}>
          <Upload aria-hidden="true" />
          Enviar
        </Button>
      </div>
      {grandeDemais && (
        <p role="alert" className="text-13 text-perigo">
          O arquivo passa de {maxMb} MB.
        </p>
      )}
      {enviar.isError && (
        <p role="alert" className="text-13 text-perigo">
          {enviar.error.message}
        </p>
      )}
      {aviso && !enviar.isError && (
        <p role="status" className="text-13 text-texto-2">
          {aviso}
        </p>
      )}
    </form>
  );
}
