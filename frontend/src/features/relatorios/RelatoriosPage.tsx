import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { CampoPessoa } from '../../shared/CampoPessoa'
import { encontrarPessoaPorNome, existeSugestaoPara } from '../../shared/encontrarPessoaPorNome'
import { formatarDataBr, formatarDataHoraBr } from '../../shared/formatarData'
import { buscarTotalApontadoPorProjeto } from '../kanban/api'
import { listarPessoas, listarProjetos } from '../organizacao/api'
import { buscarDiasInconsistentes, buscarEspelhoDoMes } from '../ponto/api'
import { formatarMinutos, formatarSaldo } from '../ponto/formatarMinutos'
import { buscarEstatisticas } from './api'
import { formatarFaixaDeHora, horaDePico, periodoPadrao } from './estatisticasUtils'
import { MiniGraficoBarras } from './MiniGraficoBarras'
import type { RankingPessoa } from './types'

/** Uma tabela "pessoa → valor" (horas trabalhadas, tarefas concluídas ou reuniões) - as três
 * seções de ranking de equipe são idênticas na forma, só muda o rótulo/formatação do valor. */
function TabelaRanking({ ranking, rotuloValor, formatarValor }: {
  ranking: RankingPessoa[]
  rotuloValor: string
  formatarValor: (valor: number) => string
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tabela-elegante">
        <thead>
          <tr>
            <th>Pessoa</th>
            <th>{rotuloValor}</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((linha, indice) => (
            <tr key={linha.usuarioId}>
              <td>{indice === 0 && ranking.length > 1 ? `🏅 ${linha.nome}` : linha.nome}</td>
              <td>{formatarValor(linha.valor)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Pedido do cliente: pessoa referenciada por nome, não por id, em qualquer lugar do sistema - o
 * campo digita o nome e sugere as pessoas cadastradas (`CampoPessoa`); em branco continua
 * significando "eu mesmo" (comportamento anterior preservado).
 *
 * Pedido do usuário: "total de horas trabalhadas, quantidade de atividades feitas, o que fez,
 * quantos projetos concluiu, todas as estatísticas possíveis, horário que mais trabalhou, pessoa
 * que fez mais reuniões, horário preferido de reuniões, um monte de estatística legal" - dashboard
 * novo (`buscarEstatisticas`, um endpoint agregador só) além das três seções de ponto que já
 * existiam.
 *
 * Pedido do usuário (segunda rodada): "ela só traz essas informações usando o filtro... quero
 * trazer as informações que eu pedi, sem usar o filtro" - início/fim já nascem preenchidos
 * (`periodoPadrao`: mês corrente até hoje) em vez de vazios, então o dashboard aparece assim que a
 * página carrega; o filtro continua existindo pra quem quiser outro período ou outra pessoa.
 */
export function RelatoriosPage() {
  const [nomeUsuario, setNomeUsuario] = useState('')
  const [inicio, setInicio] = useState(() => periodoPadrao(new Date()).inicio)
  const [fim, setFim] = useState(() => periodoPadrao(new Date()).fim)
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

  const estatisticasQuery = useQuery({
    queryKey: ['relatorios', 'estatisticas', usuarioId, inicio, fim, nomeNaoEncontrado],
    queryFn: () => buscarEstatisticas({ usuarioId, inicio: inicioInstante, fim: fimInstante }),
    enabled: periodoCompleto && !nomeNaoEncontrado,
  })
  const estatisticas = estatisticasQuery.data
  const picoHorasTrabalhadas = estatisticas ? horaDePico(estatisticas.pessoal.minutosPorHoraDoDia) : null
  const picoReunioesDaEquipe = estatisticas ? horaDePico(estatisticas.equipe.reunioesPorHoraDoDia) : null
  const equipeTemMaisDeUmaPessoa = (estatisticas?.equipe.rankingHorasTrabalhadas.length ?? 0) > 1

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

      {!periodoCompleto && <p className="mensagem-vazia">Informe início e fim pra ver as estatísticas do período.</p>}
      {periodoCompleto && !nomeNaoEncontrado && estatisticasQuery.isPending && <p className="mensagem-carregando">Carregando…</p>}
      {estatisticasQuery.isError && <p className="mensagem-erro">Não foi possível carregar as estatísticas.</p>}

      {estatisticas && (
        <>
          <section className="secao cartao">
            <h2 className="secao-titulo">📊 Visão geral</h2>
            <div className="grade-stats">
              <div className="stat-cartao">
                <div className="stat-cartao-rotulo">Horas trabalhadas</div>
                <div className="stat-cartao-valor">{formatarMinutos(estatisticas.pessoal.totalMinutosTrabalhados)}</div>
              </div>
              <div className="stat-cartao">
                <div className="stat-cartao-rotulo">Dias trabalhados</div>
                <div className="stat-cartao-valor">{estatisticas.pessoal.diasTrabalhados}</div>
              </div>
              <div className="stat-cartao">
                <div className="stat-cartao-rotulo">Média por dia trabalhado</div>
                <div className="stat-cartao-valor">{formatarMinutos(estatisticas.pessoal.mediaMinutosPorDiaTrabalhado)}</div>
              </div>
              <div className="stat-cartao">
                <div className="stat-cartao-rotulo">Atividades concluídas</div>
                <div className="stat-cartao-valor">{estatisticas.pessoal.tarefasConcluidas}</div>
              </div>
              <div className="stat-cartao">
                <div className="stat-cartao-rotulo">Projetos concluídos (todos os tempos)</div>
                <div className="stat-cartao-valor">{estatisticas.pessoal.projetosConcluidos}</div>
              </div>
              <div className="stat-cartao">
                <div className="stat-cartao-rotulo">Reuniões participadas</div>
                <div className="stat-cartao-valor">{estatisticas.pessoal.reunioesParticipadas}</div>
              </div>
            </div>
          </section>

          <section className="secao cartao">
            <h2 className="secao-titulo">✅ O que fez</h2>
            {estatisticas.pessoal.tarefasConcluidasDetalhe.length === 0 && (
              <p className="mensagem-vazia">Nenhuma atividade concluída no período.</p>
            )}
            {estatisticas.pessoal.tarefasConcluidasDetalhe.length > 0 && (
              <ul className="lista-cartoes">
                {estatisticas.pessoal.tarefasConcluidasDetalhe.map((tarefa) => (
                  <li key={tarefa.cardId} className="cartao-item">
                    <div className="cartao-item-cabecalho">
                      <span className="cartao-item-titulo">{tarefa.titulo}</span>
                      <span className="badge">{tarefa.nomeProjeto}</span>
                    </div>
                    <div className="cartao-item-corpo">
                      <span className="cartao-item-meta">Concluída em {formatarDataHoraBr(tarefa.concluidoEm)}</span>
                      {tarefa.descricaoConclusao && <p>{tarefa.descricaoConclusao}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="secao cartao">
            <h2 className="secao-titulo">🕒 Horário que mais trabalhou</h2>
            {picoHorasTrabalhadas === null && <p className="mensagem-vazia">Sem sessões de trabalho registradas no período.</p>}
            {picoHorasTrabalhadas !== null && (
              <>
                <p>
                  Você trabalha mais entre <strong>{formatarFaixaDeHora(picoHorasTrabalhadas)}</strong>.
                </p>
                <MiniGraficoBarras
                  valores={estatisticas.pessoal.minutosPorHoraDoDia}
                  formatarValor={(minutos) => formatarMinutos(minutos)}
                />
              </>
            )}
          </section>
        </>
      )}

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

      {estatisticas && (
        <section className="secao cartao">
          <h2 className="secao-titulo">🏆 Equipe</h2>
          {!equipeTemMaisDeUmaPessoa && <p className="mensagem-vazia">Sem outras pessoas visíveis pra comparar.</p>}
          {equipeTemMaisDeUmaPessoa && (
            <>
              <h3>⏱️ Horas trabalhadas</h3>
              <TabelaRanking
                ranking={estatisticas.equipe.rankingHorasTrabalhadas}
                rotuloValor="Horas"
                formatarValor={(valor) => formatarMinutos(valor)}
              />

              <h3>✅ Atividades concluídas</h3>
              <TabelaRanking
                ranking={estatisticas.equipe.rankingTarefasConcluidas}
                rotuloValor="Atividades"
                formatarValor={(valor) => String(valor)}
              />

              <h3>📅 Pessoa que fez mais reuniões</h3>
              <TabelaRanking
                ranking={estatisticas.equipe.rankingReunioes}
                rotuloValor="Reuniões"
                formatarValor={(valor) => String(valor)}
              />

              <h3>🕒 Horário preferido de reuniões</h3>
              {picoReunioesDaEquipe === null && <p className="mensagem-vazia">Nenhuma reunião no período.</p>}
              {picoReunioesDaEquipe !== null && (
                <>
                  <p>
                    A equipe prefere reuniões entre <strong>{formatarFaixaDeHora(picoReunioesDaEquipe)}</strong>.
                  </p>
                  <MiniGraficoBarras
                    valores={estatisticas.equipe.reunioesPorHoraDoDia}
                    formatarValor={(quantidade) => `${quantidade} reunião(ões)`}
                  />
                </>
              )}
            </>
          )}
        </section>
      )}
    </main>
  )
}
