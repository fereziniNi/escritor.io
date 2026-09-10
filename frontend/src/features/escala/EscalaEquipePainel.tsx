import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { formatarDataBr } from '../../shared/formatarData'
import { buscarEscalaDaEquipe, listarReunioesDaEquipe } from './api'
import { segundaFeiraDaSemana, somarDias } from './datasEscala'
import { MarcarReuniaoComMeetModal } from './MarcarReuniaoComMeetModal'
import type { Reuniao } from './types'
import './Escala.css'

const DIAS_DA_SEMANA_ABREVIADOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function horaCurta(hora: string | null): string {
  return hora ? hora.slice(0, 5) : ''
}

/**
 * Pedido do usuário: "para que o admin/chefe conseguir ver os momentos em que os funcionários
 * estarão trabalhando" - uma semana por vez, uma linha por colaborador visível (`GET
 * /escala/equipe`, já filtrado por {@code VisibilidadeUsuarioService}: GESTOR só vê quem divide
 * projeto com ele, ADMIN vê todo mundo). Ninguém edita a ESCALA de outra pessoa aqui - clicar numa
 * célula de dia trabalhado só pré-preenche o participante/data no modal de marcar reunião
 * (`MarcarReuniaoComMeetModal`, aberto a qualquer usuário - essa tabela é só um atalho pra chefe
 * não precisar procurar o nome no filtro).
 */
export function EscalaEquipePainel() {
  const [inicioDaSemana, setInicioDaSemana] = useState(() => {
    const hoje = new Date()
    return segundaFeiraDaSemana(hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate())
  })
  const fimDaSemana = somarDias(inicioDaSemana, 6)
  const diasDaSemana = Array.from({ length: 7 }, (_, indice) => somarDias(inicioDaSemana, indice))
  const [selecao, setSelecao] = useState<{ usuarioId: number; data: string } | null>(null)

  const equipeQuery = useQuery({
    queryKey: ['escala', 'equipe', inicioDaSemana, fimDaSemana],
    queryFn: () => buscarEscalaDaEquipe(inicioDaSemana, fimDaSemana),
  })
  const reunioesQuery = useQuery({
    queryKey: ['escala', 'reunioes', 'equipe', inicioDaSemana, fimDaSemana],
    queryFn: () => listarReunioesDaEquipe(inicioDaSemana, fimDaSemana),
  })
  const reunioesPorParticipanteEData = new Map<string, Reuniao[]>()
  for (const reuniao of reunioesQuery.data ?? []) {
    for (const participante of reuniao.participantes) {
      const chave = `${participante.id}|${reuniao.data}`
      reunioesPorParticipanteEData.set(chave, [...(reunioesPorParticipanteEData.get(chave) ?? []), reuniao])
    }
  }

  return (
    <section className="secao cartao">
      <h2 className="secao-titulo">👥 Escala da equipe</h2>

      <div className="escala-calendario-cabecalho">
        <button
          type="button"
          className="botao-secundario"
          aria-label="Semana anterior"
          onClick={() => setInicioDaSemana(somarDias(inicioDaSemana, -7))}
        >
          ←
        </button>
        <strong>
          {formatarDataBr(inicioDaSemana)} a {formatarDataBr(fimDaSemana)}
        </strong>
        <button
          type="button"
          className="botao-secundario"
          aria-label="Próxima semana"
          onClick={() => setInicioDaSemana(somarDias(inicioDaSemana, 7))}
        >
          →
        </button>
      </div>

      {equipeQuery.isPending && <p className="mensagem-carregando">Carregando…</p>}
      {equipeQuery.isError && <p className="mensagem-erro">Não foi possível carregar a escala da equipe.</p>}
      {equipeQuery.data?.length === 0 && <p className="mensagem-vazia">Ninguém visível pra você no momento.</p>}

      {equipeQuery.data && equipeQuery.data.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="tabela-elegante escala-equipe-tabela">
            <thead>
              <tr>
                <th>Colaborador</th>
                {diasDaSemana.map((data, indice) => (
                  <th key={data}>
                    {DIAS_DA_SEMANA_ABREVIADOS[indice]} {formatarDataBr(data)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {equipeQuery.data.map((membro) => (
                <tr key={membro.usuarioId}>
                  <td>{membro.usuarioNome}</td>
                  {membro.dias.map((dia) => {
                    if (!dia.trabalha) {
                      return <td key={dia.data}>—</td>
                    }
                    const reunioesDoDia = reunioesPorParticipanteEData.get(`${membro.usuarioId}|${dia.data}`) ?? []
                    return (
                      <td key={dia.data}>
                        <button
                          type="button"
                          className="escala-equipe-celula-dia"
                          onClick={() => setSelecao({ usuarioId: membro.usuarioId, data: dia.data })}
                        >
                          {horaCurta(dia.horaInicio)}–{horaCurta(dia.horaFim)}
                          {reunioesDoDia.map((reuniao) => (
                            <span key={reuniao.id} className="escala-reuniao-chip">
                              📹 {reuniao.titulo}
                            </span>
                          ))}
                        </button>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selecao && (
        <MarcarReuniaoComMeetModal
          participanteInicialId={selecao.usuarioId}
          dataInicial={selecao.data}
          aoFechar={() => setSelecao(null)}
        />
      )}
    </section>
  )
}
