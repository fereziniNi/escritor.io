import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { definirEscalaSemanal, listarEscalaSemanal } from './api'
import type { DiaSemana, ItemEscalaSemanal } from './types'

const DIAS_SEMANA: { valor: DiaSemana; rotulo: string }[] = [
  { valor: 'MONDAY', rotulo: 'Segunda-feira' },
  { valor: 'TUESDAY', rotulo: 'Terça-feira' },
  { valor: 'WEDNESDAY', rotulo: 'Quarta-feira' },
  { valor: 'THURSDAY', rotulo: 'Quinta-feira' },
  { valor: 'FRIDAY', rotulo: 'Sexta-feira' },
  { valor: 'SATURDAY', rotulo: 'Sábado' },
  { valor: 'SUNDAY', rotulo: 'Domingo' },
]

interface LinhaDia {
  trabalha: boolean
  horaInicio: string
  horaFim: string
}

function linhaPadrao(): LinhaDia {
  return { trabalha: false, horaInicio: '09:00', horaFim: '18:00' }
}

function linhasVazias(): Record<DiaSemana, LinhaDia> {
  const linhas = {} as Record<DiaSemana, LinhaDia>
  for (const dia of DIAS_SEMANA) {
    linhas[dia.valor] = linhaPadrao()
  }
  return linhas
}

/**
 * Pedido do usuário: "calendário individual... com opção de deixar sempre a configuração" - um
 * checkbox + horário por dia da semana, salvos de uma vez só (`PUT /escala/semanal` substitui o
 * padrão inteiro, ver `EscalaService#definirSemanal`). Fica valendo toda semana até o próprio
 * usuário mudar de novo - "sempre a configuração" do pedido.
 */
export function PadraoSemanalForm() {
  const queryClient = useQueryClient()
  const semanalQuery = useQuery({ queryKey: ['escala', 'semanal'], queryFn: listarEscalaSemanal })
  const [linhas, setLinhas] = useState<Record<DiaSemana, LinhaDia>>(linhasVazias)

  // mesmo padrão de `IntegracaoWhatsAppPage`'s `ResumoDiarioConfig`: sincroniza o rascunho local
  // com o que veio do servidor sempre que os dados mudam (inclusive depois de salvar, via
  // `queryClient.setQueryData` no `onSuccess` da mutação abaixo).
  useEffect(() => {
    if (!semanalQuery.data) {
      return
    }
    const novasLinhas = linhasVazias()
    for (const item of semanalQuery.data) {
      novasLinhas[item.diaSemana] = { trabalha: true, horaInicio: item.horaInicio.slice(0, 5), horaFim: item.horaFim.slice(0, 5) }
    }
    setLinhas(novasLinhas)
  }, [semanalQuery.data])

  const salvarMutation = useMutation({
    mutationFn: () => {
      const itens: ItemEscalaSemanal[] = DIAS_SEMANA.filter((dia) => linhas[dia.valor].trabalha).map((dia) => ({
        diaSemana: dia.valor,
        horaInicio: `${linhas[dia.valor].horaInicio}:00`,
        horaFim: `${linhas[dia.valor].horaFim}:00`,
      }))
      return definirEscalaSemanal(itens)
    },
    onSuccess: (dados) => queryClient.setQueryData(['escala', 'semanal'], dados),
  })

  function alterarLinha(dia: DiaSemana, alteracoes: Partial<LinhaDia>) {
    setLinhas((atual) => ({ ...atual, [dia]: { ...atual[dia], ...alteracoes } }))
  }

  return (
    <section className="secao cartao">
      <h2 className="secao-titulo">🔁 Padrão semanal</h2>
      <p className="mensagem-vazia">Marque os dias em que você sempre trabalha - fica valendo toda semana até você mudar.</p>

      {semanalQuery.isPending && <p className="mensagem-carregando">Carregando…</p>}
      {semanalQuery.isError && <p className="mensagem-erro">Não foi possível carregar o padrão semanal.</p>}

      {!semanalQuery.isPending && !semanalQuery.isError && (
        <form
          className="escala-padrao-semanal"
          onSubmit={(evento) => {
            evento.preventDefault()
            salvarMutation.mutate()
          }}
        >
          <ul className="escala-padrao-semanal-lista">
            {DIAS_SEMANA.map((dia) => {
              const linha = linhas[dia.valor]
              return (
                <li key={dia.valor} className="escala-padrao-semanal-linha">
                  <label className="escala-padrao-semanal-dia">
                    <input
                      type="checkbox"
                      checked={linha.trabalha}
                      onChange={(evento) => alterarLinha(dia.valor, { trabalha: evento.target.checked })}
                    />
                    {dia.rotulo}
                  </label>
                  <input
                    type="time"
                    aria-label={`Início em ${dia.rotulo}`}
                    value={linha.horaInicio}
                    disabled={!linha.trabalha}
                    onChange={(evento) => alterarLinha(dia.valor, { horaInicio: evento.target.value })}
                  />
                  <span aria-hidden="true">até</span>
                  <input
                    type="time"
                    aria-label={`Fim em ${dia.rotulo}`}
                    value={linha.horaFim}
                    disabled={!linha.trabalha}
                    onChange={(evento) => alterarLinha(dia.valor, { horaFim: evento.target.value })}
                  />
                </li>
              )
            })}
          </ul>

          <div className="linha-botoes">
            <button type="submit" disabled={salvarMutation.isPending}>
              💾 Salvar padrão semanal
            </button>
          </div>
          {salvarMutation.isError && <p className="mensagem-erro">Não foi possível salvar o padrão semanal.</p>}
          {salvarMutation.isSuccess && <p className="mensagem-sucesso">✅ Padrão semanal salvo.</p>}
        </form>
      )}
    </section>
  )
}
