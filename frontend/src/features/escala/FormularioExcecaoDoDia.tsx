import { useState } from 'react'
import type { SalvarExcecaoInput } from './types'

function horaCurta(hora: string | null): string {
  return hora ? hora.slice(0, 5) : ''
}

/**
 * Formulário inline de uma exceção pontual - compartilhado pelas 3 visões do calendário
 * (`CalendarioMes` abre com o horário efetivo atual do dia clicado; `CalendarioSemana`/
 * `CalendarioDia` abrem com o horário arrastado/clicado na grade, via `horaInicioSugerida`/
 * `horaFimSugerida`, que têm prioridade sobre o horário efetivo quando presentes).
 */
export function FormularioExcecaoDoDia({
  data,
  trabalhaInicial,
  horaInicioInicial,
  horaFimInicial,
  horaInicioSugerida,
  horaFimSugerida,
  observacaoInicial,
  excecaoExistenteId,
  salvando,
  removendo,
  erro,
  aoSalvar,
  aoRemover,
  aoFechar,
}: {
  data: string
  trabalhaInicial: boolean
  horaInicioInicial: string | null
  horaFimInicial: string | null
  horaInicioSugerida?: string
  horaFimSugerida?: string
  observacaoInicial?: string | null
  excecaoExistenteId: number | null
  salvando: boolean
  removendo: boolean
  erro: boolean
  aoSalvar: (dados: SalvarExcecaoInput) => void
  aoRemover: (id: number) => void
  aoFechar: () => void
}) {
  const [trabalha, setTrabalha] = useState(horaInicioSugerida ? true : trabalhaInicial)
  const [horaInicio, setHoraInicio] = useState(horaInicioSugerida ?? horaCurta(horaInicioInicial) ?? '09:00')
  const [horaFim, setHoraFim] = useState(horaFimSugerida ?? horaCurta(horaFimInicial) ?? '18:00')
  const [observacao, setObservacao] = useState(observacaoInicial ?? '')

  const [ano, mesIndex, dia] = data.split('-')

  return (
    <form
      className="escala-calendario-formulario formulario"
      onSubmit={(evento) => {
        evento.preventDefault()
        aoSalvar({
          data,
          trabalha,
          horaInicio: trabalha ? `${horaInicio}:00` : null,
          horaFim: trabalha ? `${horaFim}:00` : null,
          observacao: observacao.trim() || null,
        })
      }}
    >
      <h3 className="secao-titulo">
        {dia}/{mesIndex}/{ano}
      </h3>

      <div className="campo">
        <label>
          <input type="checkbox" checked={trabalha} onChange={(evento) => setTrabalha(evento.target.checked)} />
          Trabalho nesse dia
        </label>
      </div>

      {trabalha && (
        <div className="escala-calendario-formulario-horario">
          <div className="campo">
            <label htmlFor="excecao-hora-inicio">Início</label>
            <input
              id="excecao-hora-inicio"
              type="time"
              value={horaInicio}
              onChange={(evento) => setHoraInicio(evento.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="excecao-hora-fim">Fim</label>
            <input id="excecao-hora-fim" type="time" value={horaFim} onChange={(evento) => setHoraFim(evento.target.value)} />
          </div>
        </div>
      )}

      <div className="campo">
        <label htmlFor="excecao-observacao">Observação (opcional)</label>
        <input
          id="excecao-observacao"
          value={observacao}
          onChange={(evento) => setObservacao(evento.target.value)}
          maxLength={200}
          placeholder="Ex.: plantão, feriado, folga combinada..."
        />
      </div>

      <div className="linha-botoes">
        <button type="submit" disabled={salvando}>
          💾 Salvar
        </button>
        {excecaoExistenteId !== null && (
          <button
            type="button"
            className="botao-secundario"
            disabled={removendo}
            onClick={() => aoRemover(excecaoExistenteId)}
          >
            Remover exceção
          </button>
        )}
        <button type="button" className="botao-secundario" onClick={aoFechar}>
          Cancelar
        </button>
      </div>
      {erro && <p className="mensagem-erro">Não foi possível salvar a exceção.</p>}
    </form>
  )
}
