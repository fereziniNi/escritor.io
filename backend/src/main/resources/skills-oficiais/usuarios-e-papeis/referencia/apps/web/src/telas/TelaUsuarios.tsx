// origem: skills-modelo/apps/web/src/telas/TelaUsuarios.tsx
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PAPEIS, type Papel, ROTULO_PAPEL, type Usuario } from 'contratos';
import { type FormEvent, useState } from 'react';
import { CabecalhoPagina } from '@/componentes/CabecalhoPagina';
import { Campo, classeCampo } from '@/componentes/Campo';
import { Cartao } from '@/componentes/Cartao';
import { Carregando, ErroCarregar, EstadoVazio } from '@/componentes/estados';
import { Selo } from '@/componentes/Selo';
import { Button } from '@/componentes/ui/button';
import { formatarData } from '@/lib/formatos';
import { alterarPapelUsuario, convidarUsuario, desativarUsuario, listarUsuarios, reativarUsuario } from '@/lib/usuarios-api';

const CHAVE = ['usuarios'] as const;

/**
 * Administração de usuários (só ADMIN; a API recusa os outros com 403). Convidar, trocar papel, desativar e reativar.
 * Não existe "apagar": desativar mantém o histórico. As regras (último administrador, e-mail repetido) vêm da API e
 * aparecem aqui com a mensagem dela.
 */
export function TelaUsuarios() {
  const cliente = useQueryClient();
  const lista = useQuery({ queryKey: CHAVE, queryFn: listarUsuarios });
  const [email, setEmail] = useState('');
  const [nome, setNome] = useState('');
  const [papel, setPapel] = useState<Papel>('USUARIO');
  const [aviso, setAviso] = useState<string | null>(null);

  const atualizar = () => cliente.invalidateQueries({ queryKey: CHAVE });
  const convidar = useMutation({
    mutationFn: convidarUsuario,
    onSuccess: async (criado) => {
      setAviso(`Convite enviado para ${criado.email}.`);
      setEmail('');
      setNome('');
      setPapel('USUARIO');
      await atualizar();
    },
  });
  const trocarPapel = useMutation({ mutationFn: (v: { id: string; papel: Papel }) => alterarPapelUsuario(v.id, v.papel), onSuccess: atualizar });
  const alternar = useMutation({
    mutationFn: (u: Usuario) => (u.ativo ? desativarUsuario(u.id) : reativarUsuario(u.id)),
    onSuccess: atualizar,
  });

  const erro = convidar.error ?? trocarPapel.error ?? alternar.error;
  const ocupado = convidar.isPending || trocarPapel.isPending || alternar.isPending;

  function aoEnviar(e: FormEvent) {
    e.preventDefault();
    setAviso(null);
    trocarPapel.reset();
    alternar.reset();
    convidar.mutate({ email: email.trim(), nome: nome.trim(), papel });
  }

  return (
    <div>
      <CabecalhoPagina titulo="Usuários" descricao="Quem acessa o sistema e com qual papel" />

      <Cartao titulo="Convidar" className="mb-4">
        <form onSubmit={aoEnviar} className="flex flex-wrap items-end gap-3">
          <div className="w-64">
            <Campo rotulo="E-mail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@exemplo.com.br" />
          </div>
          <div className="w-56">
            <Campo rotulo="Nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="flex w-44 flex-col gap-1">
            <label htmlFor="convite-papel" className="text-xs font-medium text-texto-2">
              Papel
            </label>
            <select id="convite-papel" className={classeCampo} value={papel} onChange={(e) => setPapel(e.target.value as Papel)}>
              {PAPEIS.map((p) => (
                <option key={p} value={p}>
                  {ROTULO_PAPEL[p]}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={ocupado}>
            Convidar
          </Button>
        </form>
        <p className="mt-2 text-xs text-texto-2">A pessoa recebe um e-mail avisando do acesso e entra com o próprio e-mail.</p>
      </Cartao>

      {aviso && (
        <p role="status" className="mb-3 rounded-md bg-sucesso-suave px-3 py-2 text-13 text-sucesso">
          {aviso}
        </p>
      )}
      {erro && (
        <p role="alert" className="mb-3 rounded-md bg-perigo-suave px-3 py-2 text-13 text-perigo">
          {erro.message}
        </p>
      )}

      <Cartao className="overflow-hidden p-0">
        {lista.isPending ? (
          <Carregando texto="Carregando usuários…" />
        ) : lista.isError ? (
          <ErroCarregar mensagem={lista.error.message} aoTentarDeNovo={() => void lista.refetch()} />
        ) : lista.data.length === 0 ? (
          <EstadoVazio titulo="Nenhum usuário" descricao="Convide a primeira pessoa acima." />
        ) : (
          <table className="w-full border-collapse text-13">
            <thead>
              <tr className="border-b border-borda text-left text-xs text-texto-2">
                <th className="px-3 py-2 font-semibold">Nome</th>
                <th className="px-3 py-2 font-semibold">E-mail</th>
                <th className="px-3 py-2 font-semibold">Papel</th>
                <th className="px-3 py-2 font-semibold">Situação</th>
                <th className="px-3 py-2 font-semibold">Desde</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {lista.data.map((u) => (
                <tr key={u.id} className="border-b border-borda last:border-0">
                  <td className="px-3 py-2">{u.nome}</td>
                  <td className="px-3 py-2 font-mono">{u.email}</td>
                  <td className="px-3 py-2">
                    <select
                      aria-label={`Papel de ${u.nome}`}
                      className={`${classeCampo} h-8 w-40`}
                      value={u.papel}
                      disabled={ocupado}
                      onChange={(e) => {
                        setAviso(null);
                        trocarPapel.mutate({ id: u.id, papel: e.target.value as Papel });
                      }}
                    >
                      {PAPEIS.map((p) => (
                        <option key={p} value={p}>
                          {ROTULO_PAPEL[p]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <Selo tom={u.ativo ? 'sucesso' : 'alerta'}>{u.ativo ? 'Ativo' : 'Desativado'}</Selo>
                  </td>
                  <td className="px-3 py-2 font-mono tabular-nums">{formatarData(u.criadoEm)}</td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={ocupado}
                      onClick={() => {
                        setAviso(null);
                        alternar.mutate(u);
                      }}
                    >
                      {u.ativo ? 'Desativar' : 'Reativar'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Cartao>
    </div>
  );
}
