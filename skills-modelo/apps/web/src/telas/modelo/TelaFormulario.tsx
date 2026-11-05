import { type FormEvent, useState } from 'react';
import { CabecalhoPagina } from '@/componentes/CabecalhoPagina';
import { Campo } from '@/componentes/Campo';
import { Cartao } from '@/componentes/Cartao';
import { Button } from '@/componentes/ui/button';
import { formatarCnpj } from '@/lib/formatos';

interface Props {
  aoSalvar: (dados: { nome: string; cnpj: string }) => void;
}

/** Formulário padrão: rótulo acima, erro abaixo do campo, ações no fim. CNPJ é guardado só com dígitos. */
export function TelaFormulario({ aoSalvar }: Props) {
  const [nome, setNome] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [erros, setErros] = useState<{ nome?: string; cnpj?: string }>({});

  function enviar(e: FormEvent) {
    e.preventDefault();
    const digitos = cnpj.replace(/\D/g, '');
    const novos: { nome?: string; cnpj?: string } = {};
    if (!nome.trim()) novos.nome = 'Informe o nome';
    if (digitos.length !== 14) novos.cnpj = 'CNPJ deve ter 14 dígitos';
    setErros(novos);
    if (Object.keys(novos).length === 0) aoSalvar({ nome: nome.trim(), cnpj: digitos });
  }

  return (
    <form onSubmit={enviar} noValidate className="max-w-xl">
      <CabecalhoPagina titulo="Novo cedente" descricao="Dados cadastrais" />
      <Cartao>
        <div className="flex flex-col gap-4">
          <Campo rotulo="Nome" value={nome} onChange={(e) => setNome(e.target.value)} erro={erros.nome} />
          <Campo
            rotulo="CNPJ"
            inputMode="numeric"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            onBlur={() => setCnpj(formatarCnpj(cnpj))}
            erro={erros.cnpj}
          />
        </div>
        <div className="mt-4 flex gap-2">
          <Button type="submit">Salvar</Button>
          <Button type="reset" variant="outline" onClick={() => setErros({})}>
            Cancelar
          </Button>
        </div>
      </Cartao>
    </form>
  );
}
