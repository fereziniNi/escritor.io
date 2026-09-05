import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { formatarDataBr } from '../../shared/formatarData'
import { buscarEscalaDaEquipe } from './api'
import { segundaFeiraDaSemana, somarDias } from './datasEscala'
import './Escala.css'

const DIAS_DA_SEMANA_ABREVIADOS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function horaCurta(hora: string | null): string {
  return hora ? hora.slice(0, 5) : ''
}

/**
 * Pedido do usuário: "para que o admin/chefe conseguir ver os momentos em que os funcionários
 * estarão trabalhando ou terão a possibilidade de ajudar" - uma semana por vez (setas
 * anterior/atual/próxima), uma linha por colaborador visível (`GET /escala/equipe`, já filtrado
 * por {@code VisibilidadeUsuarioService} no backend: GESTOR só vê quem divide projeto com ele,
 * ADMIN vê todo mundo). Somente leitura - ninguém edita a escala de outra pessoa aqui.
 */
export function EscalaEquipePainel() {
  const [inicioDaSemana, setInicioDaSemana] = useState(() => {
    const hoje = new Date()
    return segundaFeiraDaSemana(hoje.getFullYear(), hoje.getMonth() + 1, hoje.getDate())
  })
  const fimDaSemana = somarDias(inicioDaSemana, 6)
  const diasDaSemana = Array.from({ length: 7 }, (_, indice) => somarDias(inicioDaSemana, indice))

  const equipeQuery = useQuery({
    queryKey: ['escala', 'equipe', inicioDaSemana, fimDaSemana],
    queryFn: () => buscarEscalaDaEquipe(inicioDaSemana, fimDaSemana),
  })

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
                  {membro.dias.map((dia) => (
                    <td key={dia.data}>{dia.trabalha ? `${horaCurta(dia.horaInicio)}–${horaCurta(dia.horaFim)}` : '—'}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
