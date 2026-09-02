import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { formatarDataBr } from '../../shared/formatarData'
import { buscarTotalApontadoPorProjeto } from '../kanban/api'
import { listarProjetos } from '../organizacao/api'
import { buscarDiasInconsistentes, buscarEspelhoDoMes } from '../ponto/api'
import { formatarMinutos, formatarSaldo } from '../ponto/formatarMinutos'

/**
 * Seletor de pessoa é um id numérico digitado, não um dropdown de nomes de propósito (S5.8): não
 * existe ainda um `GET /usuarios` que um gestor possa chamar pra listar os membros dos próprios
 * projetos (só admin cadastra usuário, sem endpoint de listagem) - mesma disciplina de não construir
 * UI pra uma API que não existe (S4.4).
 */
export function RelatoriosPage() {
  const [usuarioIdTexto, setUsuarioIdTexto] = useState('')
  const [inicio, setInicio] = useState('')
  const [fim, setFim] = useState('')
  const [projetoId, setProjetoId] = useState('')

  const usuarioId = usuarioIdTexto === '' ? null : Number(usuarioIdTexto)
  const periodoCompleto = inicio !== '' && fim !== ''
  const inicioInstante = `${inicio}T00:00:00Z`
  const fimInstante = `${fim}T00:00:00Z`

  const projetosQuery = useQuery({ queryKey: ['projetos'], queryFn: listarProjetos })

  const espelhoQuery = useQuery({
    queryKey: ['ponto', 'espelho-do-mes', usuarioId],
    queryFn: () => buscarEspelhoDoMes(usuarioId ?? undefined),
  })

  const diasInconsistentesQuery = useQuery({
    queryKey: ['ponto', 'dias-inconsistentes', usuarioId, inicio, fim],
    queryFn: () => buscarDiasInconsistentes({ usuarioId, inicio: inicioInstante, fim: fimInstante }),
    enabled: periodoCompleto,
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
            <label htmlFor="usuario-id-relatorio">Usuário (id, em branco = eu mesmo)</label>
            <input
              id="usuario-id-relatorio"
              value={usuarioIdTexto}
              onChange={(evento) => setUsuarioIdTexto(evento.target.value)}
            />
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
        {espelhoQuery.isPending && <p className="mensagem-carregando">Carregando…</p>}
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
