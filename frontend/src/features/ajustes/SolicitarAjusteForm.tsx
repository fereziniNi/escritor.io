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
      onSubmit={(evento) => {
        evento.preventDefault()
        mutation.mutate()
      }}
    >
      <h2>Solicitar ajuste de ponto</h2>

      <label htmlFor="tipo-ajuste">Tipo</label>
      <select id="tipo-ajuste" value={tipo} onChange={(evento) => setTipo(evento.target.value as TipoRegistroPonto)}>
        {OPCOES_TIPO.map((opcao) => (
          <option key={opcao.valor} value={opcao.valor}>
            {opcao.rotulo}
          </option>
        ))}
      </select>

      <label htmlFor="momento-ajuste">Data e hora</label>
      <input
        id="momento-ajuste"
        type="datetime-local"
        value={momento}
        onChange={(evento) => setMomento(evento.target.value)}
        required
      />

      <label htmlFor="justificativa-ajuste">Justificativa</label>
      <textarea
        id="justificativa-ajuste"
        value={justificativa}
        onChange={(evento) => setJustificativa(evento.target.value)}
        required
      />

      <button type="submit" disabled={mutation.isPending}>
        Enviar solicitação
      </button>
      {mutation.isError && <p>Não foi possível enviar a solicitação.</p>}
      {mutation.isSuccess && <p>Solicitação enviada.</p>}
    </form>
  )
}
