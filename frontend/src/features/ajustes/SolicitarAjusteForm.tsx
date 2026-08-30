import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import type { TipoRegistroPonto } from '../ponto/types'
import { solicitarAjuste } from './api'

const OPCOES_TIPO: Array<{ valor: TipoRegistroPonto; rotulo: string }> = [
  { valor: 'ENTRADA', rotulo: 'Entrada' },
  { valor: 'PAUSA_INICIO', rotulo: 'Início de pausa' },
  { valor: 'PAUSA_FIM', rotulo: 'Fim de pausa' },
  { valor: 'SAIDA', rotulo: 'Saída' },
]

export function SolicitarAjusteForm() {
  const [tipo, setTipo] = useState<TipoRegistroPonto>('ENTRADA')
  const [momento, setMomento] = useState('')
  const [justificativa, setJustificativa] = useState('')

  const mutation = useMutation({
    mutationFn: () => solicitarAjuste({ tipo, momento: new Date(momento).toISOString(), justificativa }),
    onSuccess: () => {
      setMomento('')
      setJustificativa('')
    },
  })

  return (
    <form
      className="secao cartao"
      onSubmit={(evento) => {
        evento.preventDefault()
        mutation.mutate()
      }}
    >
      <h2 className="secao-titulo">✍️ Solicitar ajuste de ponto</h2>

      <div className="formulario">
        <div className="campo">
          <label htmlFor="tipo-ajuste">Tipo</label>
          <select id="tipo-ajuste" value={tipo} onChange={(evento) => setTipo(evento.target.value as TipoRegistroPonto)}>
            {OPCOES_TIPO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
          </select>
        </div>

        <div className="campo">
          <label htmlFor="momento-ajuste">Data e hora</label>
          <input
            id="momento-ajuste"
            type="datetime-local"
            value={momento}
            onChange={(evento) => setMomento(evento.target.value)}
            required
          />
        </div>

        <div className="campo formulario-largo" style={{ gridColumn: '1 / -1' }}>
          <label htmlFor="justificativa-ajuste">Justificativa</label>
          <textarea
            id="justificativa-ajuste"
            value={justificativa}
            onChange={(evento) => setJustificativa(evento.target.value)}
            required
          />
        </div>

        <div className="campo-acoes">
          <button type="submit" disabled={mutation.isPending}>
            📨 Enviar solicitação
          </button>
          {mutation.isError && <p className="mensagem-erro">Não foi possível enviar a solicitação.</p>}
          {mutation.isSuccess && <p className="mensagem-sucesso">Solicitação enviada.</p>}
        </div>
      </div>
    </form>
  )
}
