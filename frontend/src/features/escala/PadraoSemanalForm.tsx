import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { definirEscalaSemanal, listarEscalaSemanal } from './api'
import { EscalaModal } from './EscalaModal'
import type { DiaSemana, EscalaSemanal, ItemEscalaSemanal } from './types'

const DIAS_SEMANA: { valor: DiaSemana; rotulo: string }[] = [
  { valor: 'MONDAY', rotulo: 'Segunda-feira' },
  { valor: 'TUESDAY', rotulo: 'Terça-feira' },
  { valor: 'WEDNESDAY', rotulo: 'Quarta-feira' },
  { valor: 'THURSDAY', rotulo: 'Quinta-feira' },
  { valor: 'FRIDAY', rotulo: 'Sexta-feira' },
  { valor: 'SATURDAY', rotulo: 'Sábado' },
  { valor: 'SUNDAY', rotulo: 'Domingo' },
]

const ROTULO_POR_DIA = new Map(DIAS_SEMANA.map((dia) => [dia.valor, dia.rotulo]))

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

function linhasAPartirDoServidor(dados: EscalaSemanal[]): Record<DiaSemana, LinhaDia> {
  const linhas = linhasVazias()
  for (const item of dados) {
    linhas[item.diaSemana] = { trabalha: true, horaInicio: item.horaInicio.slice(0, 5), horaFim: item.horaFim.slice(0, 5) }
  }
  return linhas
}

/** "Segunda-feira" -> "Segunda" (sábado/domingo não têm "-feira" pra tirar, ficam como estão). */
function nomeCurto(rotulo: string): string {
  return rotulo.replace('-feira', '')
}

function resumoDoPadrao(dados: EscalaSemanal[] | undefined): string {
  if (!dados || dados.length === 0) {
    return 'Nenhum dia configurado ainda.'
  }
  return dados.map((item) => nomeCurto(ROTULO_POR_DIA.get(item.diaSemana) ?? item.diaSemana)).join(', ')
}

/**
 * Pedido do usuário: "calendário individual... com opção de deixar sempre a configuração" - um
 * checkbox + horário por dia da semana, salvos de uma vez só (`PUT /escala/semanal` substitui o
 * padrão inteiro, ver `EscalaService#definirSemanal`). Fica valendo toda semana até o próprio
 * usuário mudar de novo - "sempre a configuração" do pedido.
 *
 * Pedido seguinte: "eu quero que essa imagem vire um modal. Assim que a pessoa personalizar ele,
 * ficara salvo na agenda" - o formulário (lista dos 7 dias) não fica mais sempre aberto na tela;
 * um resumo de uma linha + um botão "Configurar" abrem ele num popup (`EscalaModal`, mesmo padrão
 * já usado pro horário de um dia em `EscalaCalendarioPainel`), que fecha sozinho assim que salvar
 * com sucesso.
 */
export function PadraoSemanalForm() {
  const queryClient = useQueryClient()
  const semanalQuery = useQuery({ queryKey: ['escala', 'semanal'], queryFn: listarEscalaSemanal })
  const [linhas, setLinhas] = useState<Record<DiaSemana, LinhaDia>>(linhasVazias)
  const [modalAberto, setModalAberto] = useState(false)

  // mesmo padrão de `IntegracaoWhatsAppPage`'s `ResumoDiarioConfig`: sincroniza o rascunho local
  // com o que veio do servidor sempre que os dados mudam (inclusive depois de salvar, via
  // `queryClient.setQueryData` no `onSuccess` da mutação abaixo).
  useEffect(() => {
    if (semanalQuery.data) {
      setLinhas(linhasAPartirDoServidor(semanalQuery.data))
    }
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
    onSuccess: (dados) => {
      queryClient.setQueryData(['escala', 'semanal'], dados)
      setModalAberto(false)
    },
  })

  function alterarLinha(dia: DiaSemana, alteracoes: Partial<LinhaDia>) {
    setLinhas((atual) => ({ ...atual, [dia]: { ...atual[dia], ...alteracoes } }))
  }

  /** Descarta qualquer edição não salva, voltando pro último padrão salvo de verdade - evita que
   * reabrir o modal depois de "Cancelar" mostre um rascunho abandonado. */
  function fecharSemSalvar() {
    if (semanalQuery.data) {
      setLinhas(linhasAPartirDoServidor(semanalQuery.data))
    }
    setModalAberto(false)
  }

  return (
    <section className="secao cartao">
      <h2 className="secao-titulo">🔁 Padrão semanal</h2>
      <p className="mensagem-vazia">Os dias em que você sempre trabalha - fica valendo toda semana até você mudar.</p>

      {semanalQuery.isPending && <p className="mensagem-carregando">Carregando…</p>}
      {semanalQuery.isError && <p className="mensagem-erro">Não foi possível carregar o padrão semanal.</p>}

      {!semanalQuery.isPending && !semanalQuery.isError && (
        <div className="linha-botoes">
          <p className="escala-padrao-semanal-resumo">{resumoDoPadrao(semanalQuery.data)}</p>
          <button type="button" onClick={() => setModalAberto(true)}>
            ⚙️ Configurar padrão semanal
          </button>
        </div>
      )}

      {modalAberto && (
        <EscalaModal titulo="Padrão semanal" aoFechar={fecharSemSalvar}>
          <form
            className="escala-padrao-semanal"
            onSubmit={(evento) => {
              evento.preventDefault()
              salvarMutation.mutate()
            }}
          >
            <h3 className="secao-titulo">Padrão semanal</h3>
            <p className="mensagem-vazia">Marque os dias em que você sempre trabalha.</p>

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
              <button type="button" className="botao-secundario" onClick={fecharSemSalvar}>
                Cancelar
              </button>
            </div>
            {salvarMutation.isError && <p className="mensagem-erro">Não foi possível salvar o padrão semanal.</p>}
          </form>
        </EscalaModal>
      )}
    </section>
  )
}
