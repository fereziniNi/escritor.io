import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { listarPessoas } from '../organizacao/api'
import { consultarDisponibilidade, criarReuniao } from './api'
import { dataDeHoje, nomeDoDiaDaSemana } from './datasEscala'
import { EscalaModal } from './EscalaModal'
import type { Disponibilidade } from './types'

/**
 * Pedido do usuário: "quero adicionar de alguma forma integrada ao Google Meet/Calendar... onde o
 * usuário do sistema (independente) vai conseguir marcar e entrar nas reuniões do meet pela nossa
 * plataforma... deixar disponível para entrar na reunião com quem ele quer dos funcionários".
 * Substitui a antiga `MarcarReuniaoModal` (grade de horário arrastável, um funcionário só, sem
 * Meet, só GESTOR/ADMIN): agora qualquer usuário abre este modal, escolhe um ou mais colegas
 * (`GET /usuarios/basico`, já aberto a qualquer autenticado - mesma lista do `CampoPessoa`), um
 * horário livre e um título. Ao salvar, a Google já devolveu um link de Meet de verdade - mostrado
 * com "🔗 Copiar link" (pedido: "disponibilizar o link caso queira compartilhar") e "🎥 Entrar no
 * Meet".
 *
 * <p>Pedido do usuário (depois de usar): "Não consegui marcar a reunião!! Mude o UI e UX da tela
 * de marcar a reunião. Ficou péssimo!!". Ao investigar, dois problemas reais, não só estéticos:
 * (1) o formulário rodava dentro do modal genérico de 420px (pensado pro popup de "horário de um
 * dia só") com a grade `.formulario` de 2 colunas - a lista de participantes (filtro + checkboxes
 * roláveis) ficava espremida numa coluna estreita ao lado da data; (2) não tinha nenhum jeito de
 * saber, ANTES de tentar salvar, se a pessoa convidada trabalha no dia/horário escolhido - o
 * backend só recusa depois, com um 400 sem detalhe (convenção do projeto, `TratamentoErroGlobal`
 * nunca vaza mensagem de exceção no corpo), então a experiência era "tentei, deu erro genérico, não
 * sei por quê". Esta versão: (1) abre `largo` (mais respiro) e usa `formulario-largo` (uma coluna
 * só, nada espremido) com chips mostrando quem já foi escolhido; (2) consulta `GET
 * /escala/disponibilidade` (novo endpoint, aberto a qualquer autenticado - mesma filosofia de
 * `/usuarios/basico`) assim que há participante(s) + data escolhidos, e mostra na hora se algum
 * deles não trabalha nesse horário, desabilitando "Marcar reunião" com o motivo à vista em vez de
 * deixar a pessoa descobrir só depois de tentar enviar.
 *
 * <p>`participanteInicialId`/`dataInicial` (opcionais) pré-preenchem quando aberto a partir de uma
 * célula da "Escala da equipe" - sem eles, abre em branco (pedido: "usuário independente").
 */
export function MarcarReuniaoComMeetModal({
  participanteInicialId,
  dataInicial,
  aoFechar,
}: {
  participanteInicialId?: number
  dataInicial?: string
  aoFechar: () => void
}) {
  const pessoasQuery = useQuery({ queryKey: ['pessoas'], queryFn: listarPessoas })
  const [participantes, setParticipantes] = useState<Set<number>>(new Set(participanteInicialId ? [participanteInicialId] : []))
  const [filtro, setFiltro] = useState('')
  const [data, setData] = useState(dataInicial ?? dataDeHoje())
  const [horaInicio, setHoraInicio] = useState('09:00')
  const [horaFim, setHoraFim] = useState('10:00')
  const [titulo, setTitulo] = useState('')
  const queryClient = useQueryClient()

  const idsParticipantes = useMemo(() => [...participantes].sort((a, b) => a - b), [participantes])
  const nomePorId = useMemo(() => new Map((pessoasQuery.data ?? []).map((pessoa) => [pessoa.id, pessoa.nome])), [pessoasQuery.data])

  const disponibilidadeQuery = useQuery({
    queryKey: ['escala', 'disponibilidade', idsParticipantes, data],
    queryFn: () => consultarDisponibilidade(idsParticipantes, data),
    enabled: idsParticipantes.length > 0 && !!data,
  })

  const indisponiveis = (disponibilidadeQuery.data ?? []).filter((d) => !cabeNoExpediente(d, horaInicio, horaFim))

  const criarMutation = useMutation({
    mutationFn: () =>
      criarReuniao({
        participantesIds: idsParticipantes,
        data,
        horaInicio: `${horaInicio}:00`,
        horaFim: `${horaFim}:00`,
        titulo: titulo.trim(),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['escala', 'reunioes'] })
    },
  })

  function alternarParticipante(id: number) {
    setParticipantes((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(id)) {
        proximo.delete(id)
      } else {
        proximo.add(id)
      }
      return proximo
    })
  }

  const pessoasFiltradas = (pessoasQuery.data ?? []).filter((pessoa) => pessoa.nome.toLowerCase().includes(filtro.trim().toLowerCase()))

  if (criarMutation.isSuccess) {
    const reuniao = criarMutation.data
    return (
      <EscalaModal titulo="📹 Reunião marcada" largo aoFechar={aoFechar}>
        <div className="formulario formulario-largo">
          <h3 className="secao-titulo">📹 Reunião marcada</h3>
          <p className="mensagem-sucesso">✅ Convite enviado por e-mail pra quem você chamou - já aparece na agenda deles também.</p>
          <div className="campo">
            <label htmlFor="reuniao-link-meet">Link do Meet</label>
            <input id="reuniao-link-meet" value={reuniao.linkMeet ?? ''} readOnly />
          </div>
          <div className="linha-botoes">
            <a className="botao-secundario" href={reuniao.linkMeet ?? '#'} target="_blank" rel="noreferrer">
              🎥 Entrar no Meet
            </a>
            <button type="button" className="botao-secundario" onClick={() => navigator.clipboard?.writeText(reuniao.linkMeet ?? '')}>
              🔗 Copiar link
            </button>
            <button type="button" onClick={aoFechar}>
              Fechar
            </button>
          </div>
        </div>
      </EscalaModal>
    )
  }

  return (
    <EscalaModal titulo="📹 Marcar reunião" largo aoFechar={aoFechar}>
      <form
        className="formulario formulario-largo"
        onSubmit={(evento) => {
          evento.preventDefault()
          criarMutation.mutate()
        }}
      >
        <h3 className="secao-titulo">📹 Marcar reunião</h3>
        <p className="mensagem-vazia">Escolha quem você quer chamar, o horário e ganhe um link de Google Meet na hora.</p>

        <div className="campo">
          <label htmlFor="reuniao-filtro-participantes">Participantes</label>

          {idsParticipantes.length > 0 && (
            <ul className="reuniao-participantes-chips">
              {idsParticipantes.map((id) => (
                <li key={id} className="reuniao-chip">
                  {nomePorId.get(id) ?? `#${id}`}
                  <button
                    type="button"
                    className="reuniao-chip-remover"
                    aria-label={`Remover ${nomePorId.get(id) ?? id} dos participantes`}
                    onClick={() => alternarParticipante(id)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}

          <input
            id="reuniao-filtro-participantes"
            value={filtro}
            onChange={(evento) => setFiltro(evento.target.value)}
            placeholder="Filtrar por nome"
          />
          {pessoasQuery.isPending && <p className="mensagem-carregando">Carregando…</p>}
          {pessoasQuery.isError && <p className="mensagem-erro">Não foi possível carregar a lista de pessoas.</p>}
          {pessoasQuery.data && (
            <ul className="reuniao-participantes-lista">
              {pessoasFiltradas.map((pessoa) => (
                <li key={pessoa.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={participantes.has(pessoa.id)}
                      onChange={() => alternarParticipante(pessoa.id)}
                    />
                    {pessoa.nome}
                  </label>
                </li>
              ))}
              {pessoasFiltradas.length === 0 && <li className="mensagem-vazia">Ninguém encontrado com esse nome.</li>}
            </ul>
          )}
          {participantes.size === 0 && <p className="mensagem-vazia">Escolha ao menos um participante.</p>}
        </div>

        <div className="campo">
          <label htmlFor="reuniao-data">Data</label>
          <input id="reuniao-data" type="date" value={data} onChange={(evento) => setData(evento.target.value)} required />
        </div>
        <div className="escala-calendario-formulario-horario">
          <div className="campo">
            <label htmlFor="reuniao-hora-inicio">Início</label>
            <input
              id="reuniao-hora-inicio"
              type="time"
              value={horaInicio}
              onChange={(evento) => setHoraInicio(evento.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="reuniao-hora-fim">Fim</label>
            <input id="reuniao-hora-fim" type="time" value={horaFim} onChange={(evento) => setHoraFim(evento.target.value)} />
          </div>
        </div>

        {disponibilidadeQuery.data && (
          <div className="campo reuniao-disponibilidade">
            <label>Disponibilidade em {formatarDataParaExibicao(data)}</label>
            <ul className="reuniao-disponibilidade-lista">
              {disponibilidadeQuery.data.map((disponibilidade) => (
                <li key={disponibilidade.usuarioId}>
                  {cabeNoExpediente(disponibilidade, horaInicio, horaFim) ? (
                    <span className="badge">
                      ✅ {disponibilidade.nome} trabalha das {disponibilidade.horaInicio?.slice(0, 5)} às{' '}
                      {disponibilidade.horaFim?.slice(0, 5)} nesse dia
                    </span>
                  ) : (
                    <span className="badge badge-perigo">
                      ⚠️{' '}
                      {disponibilidade.trabalha
                        ? `${disponibilidade.nome} só trabalha das ${disponibilidade.horaInicio?.slice(0, 5)} às ${disponibilidade.horaFim?.slice(0, 5)} nesse dia`
                        : `${disponibilidade.nome} não trabalha nesse dia`}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="campo">
          <label htmlFor="reuniao-titulo">Título</label>
          <input
            id="reuniao-titulo"
            value={titulo}
            onChange={(evento) => setTitulo(evento.target.value)}
            maxLength={200}
            required
            placeholder="Ex.: Reunião de alinhamento"
          />
        </div>

        {indisponiveis.length > 0 && (
          <p className="mensagem-erro">
            Ajuste o horário: {indisponiveis.map((d) => d.nome).join(', ')} não {indisponiveis.length === 1 ? 'está disponível' : 'estão disponíveis'} nesse horário.
          </p>
        )}
        {criarMutation.isError && <p className="mensagem-erro">{(criarMutation.error as Error).message}</p>}

        <div className="linha-botoes">
          <button type="submit" disabled={criarMutation.isPending || participantes.size === 0 || indisponiveis.length > 0}>
            📹 Marcar reunião
          </button>
          <button type="button" className="botao-secundario" onClick={aoFechar}>
            Cancelar
          </button>
        </div>
      </form>
    </EscalaModal>
  )
}

/** "HH:mm" do formulário cabe dentro do expediente efetivo devolvido por `/escala/disponibilidade`
 * ("HH:mm:ss") - comparação lexicográfica funciona direto pros dois formatos ("09:00" <= "09:00:00"
 * já seria falso por tamanho, por isso o `slice(0, 5)` primeiro). */
function cabeNoExpediente(disponibilidade: Disponibilidade, horaInicio: string, horaFim: string): boolean {
  if (!disponibilidade.trabalha || !disponibilidade.horaInicio || !disponibilidade.horaFim) {
    return false
  }
  return horaInicio >= disponibilidade.horaInicio.slice(0, 5) && horaFim <= disponibilidade.horaFim.slice(0, 5)
}

function formatarDataParaExibicao(dataIso: string): string {
  const [, mes, dia] = dataIso.split('-')
  return `${nomeDoDiaDaSemana(dataIso)}, ${dia}/${mes}`
}
