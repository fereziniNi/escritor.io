import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CampoPessoa } from '../../shared/CampoPessoa'
import { encontrarPessoaPorNome, existeSugestaoPara } from '../../shared/encontrarPessoaPorNome'
import { formatarDataBr } from '../../shared/formatarData'
import { buscarTotalApontadoPorProjeto } from '../kanban/api'
import { listarPessoas, listarProjetos } from '../organizacao/api'
import { buscarDiasInconsistentes, buscarEspelhoDoMes } from '../ponto/api'
import { formatarMinutos, formatarSaldo } from '../ponto/formatarMinutos'

/**
 * Pedido do cliente: pessoa referenciada por nome, não por id, em qualquer lugar do sistema - o
 * campo digita o nome e sugere as pessoas cadastradas (`CampoPessoa`); em branco continua
 * significando "eu mesmo" (comportamento anterior preservado).
 */
export function RelatoriosPage() {
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [projetoId, setProjetoId] = useState('')

  const pessoasQuery = useQuery({ queryKey: ['pessoas'], queryFn: listarPessoas })
  const pessoas = pessoasQuery.data ?? []
  const pessoaEncontrada = encontrarPessoaPorNome(pessoas, nomeUsuario)
  // Substring, não nome exato: "b" enquanto o usuário ainda está digitando "Beto Lima" (que
  // `CampoPessoa` já sugere no dropdown) não deve acender "Pessoa não encontrada" nem desligar a
  // consulta - só quando não sobra candidato nenhum pro nome digitado.
  const nomeNaoEncontrado = !existeSugestaoPara(pessoas, nomeUsuario)
  const usuarioId = pessoaEncontrada ? pessoaEncontrada.id : null
  const periodoCompleto = inicio !== '' && fim !== ''
  const inicioInstante = `${inicio}T00:00:00Z`
  const fimInstante = `${fim}T00:00:00Z`

  const projetosQuery = useQuery({ queryKey: ['projetos'], queryFn: listarProjetos })

  // `nomeNaoEncontrado` entra na queryKey (não só em `enabled`) de propósito: sem isso, digitar um
  // nome desconhecido reaproveitaria o cache de `usuarioId: null` (o mesmo da busca "eu mesmo" com
  // o campo vazio) e o saldo de outra pessoa continuaria na tela junto da mensagem de erro.
  const espelhoQuery = useQuery({
    queryKey: ['ponto', 'espelho-do-mes', usuarioId, nomeNaoEncontrado],
    queryFn: () => buscarEspelhoDoMes(usuarioId ?? undefined),
    enabled: !nomeNaoEncontrado,
  })

  const diasInconsistentesQuery = useQuery({
    queryKey: ['ponto', 'dias-inconsistentes', usuarioId, inicio, fim, nomeNaoEncontrado],
    queryFn: () => buscarDiasInconsistentes({ usuarioId, inicio: inicioInstante, fim: fimInstante }),
    enabled: periodoCompleto && !nomeNaoEncontrado,
  })

  const totalApontadoQuery = useQuery({
    queryKey: ['apontamentos', 'relatorio', projetoId, inicio, fim],
    queryFn: () =>
      buscarTotalApontadoPorProjeto({
        projetoId: Number(projetoId),
        inicio: inicioInstante,
        fim: fimInstante,
      }),
    enabled: periodoCompleto && projetoId !== '',
  })

  return (
    <main className="pagina">
      <div className="pagina-cabecalho">
        <h1>📊 Relatórios</h1>
      </div>

      <form className="secao cartao">
        <div className="formulario">
          <div className="campo">
            <CampoPessoa
              id="nome-usuario-relatorio"
              label="Usuário (nome, em branco = eu mesmo)"
              valor={nomeUsuario}
              aoMudarValor={setNomeUsuario}
              pessoas={pessoas}
              placeholder="Nome da pessoa"
            />
            {nomeNaoEncontrado && <p className="mensagem-erro">Pessoa não encontrada</p>}
          </div>

          <div className="campo">
            <label htmlFor="inicio-relatorio">Início</label>
            <input
              id="inicio-relatorio"
              type="date"
              value={inicio}
              onChange={(evento) => setInicio(evento.target.value)}
            />
          </div>

          <div className="campo">
            <label htmlFor="fim-relatorio">Fim</label>
            <input id="fim-relatorio" type="date" value={fim} onChange={(evento) => setFim(evento.target.value)} />
          </div>

          <div className="campo">
            <label htmlFor="projeto-relatorio">Projeto</label>
            <select
              id="projeto-relatorio"
              value={projetoId}
              onChange={(evento) => setProjetoId(evento.target.value)}
            >
              <option value="">Nenhum</option>
              {projetosQuery.data?.map((projeto) => (
                <option key={projeto.id} value={projeto.id}>
                  {projeto.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
      </form>

      <section className="secao cartao">
        <h2 className="secao-titulo">💰 Saldo</h2>
        {!nomeNaoEncontrado && espelhoQuery.isPending && <p className="mensagem-carregando">Carregando…</p>}
        {espelhoQuery.isError && <p className="mensagem-erro">Não foi possível carregar o saldo.</p>}
        {espelhoQuery.data && <p>Saldo acumulado: {formatarSaldo(espelhoQuery.data.saldoAcumuladoNoPeriodo)}</p>}
      </section>

      <section className="secao cartao">
        <h2 className="secao-titulo">⚠️ Dias inconsistentes no período</h2>
        {!periodoCompleto && <p className="mensagem-vazia">Informe início e fim pra ver os dias inconsistentes.</p>}
        {diasInconsistentesQuery.isError && <p className="mensagem-erro">Não foi possível carregar os dias inconsistentes.</p>}
        {diasInconsistentesQuery.data?.length === 0 && <p className="mensagem-vazia">Nenhum dia inconsistente no período.</p>}
        {diasInconsistentesQuery.data && diasInconsistentesQuery.data.length > 0 && (
          <ul className="linha-botoes" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {diasInconsistentesQuery.data.map((data) => (
              <li key={data} className="badge badge-perigo">
                {formatarDataBr(data)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="secao cartao">
        <h2 className="secao-titulo">🧮 Total apontado</h2>
        {periodoCompleto && projetoId === '' && <p className="mensagem-vazia">Selecione um projeto.</p>}
        {totalApontadoQuery.isError && <p className="mensagem-erro">Não foi possível carregar o total apontado.</p>}
        {totalApontadoQuery.data && <p>Total apontado: {formatarMinutos(totalApontadoQuery.data.totalMinutos)}</p>}
      </section>
    </main>
  )
}
