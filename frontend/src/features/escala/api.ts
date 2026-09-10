import { apiFetch } from '../../shared/api/http'
import type {
  CriarReuniaoInput,
  DiaEfetivo,
  Disponibilidade,
  EscalaEquipe,
  EscalaExcecao,
  EscalaSemanal,
  EstadoGoogle,
  ItemEscalaSemanal,
  Reuniao,
  SalvarExcecaoInput,
} from './types'

export async function listarEscalaSemanal(): Promise<EscalaSemanal[]> {
  const response = await apiFetch('/escala/semanal')
  if (!response.ok) {
    throw new Error('Não foi possível carregar o padrão semanal')
  }
  return response.json()
}

export async function definirEscalaSemanal(itens: ItemEscalaSemanal[]): Promise<EscalaSemanal[]> {
  const response = await apiFetch('/escala/semanal', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(itens),
  })
  if (!response.ok) {
    throw new Error('Não foi possível salvar o padrão semanal')
  }
  return response.json()
}

export async function listarExcecoesDaEscala(inicio: string, fim: string): Promise<EscalaExcecao[]> {
  const response = await apiFetch(`/escala/excecoes?inicio=${inicio}&fim=${fim}`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar as exceções da escala')
  }
  return response.json()
}

export async function salvarExcecaoDaEscala(dados: SalvarExcecaoInput): Promise<EscalaExcecao> {
  const response = await apiFetch('/escala/excecoes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
  if (!response.ok) {
    throw new Error('Não foi possível salvar a exceção')
  }
  return response.json()
}

export async function removerExcecaoDaEscala(id: number): Promise<void> {
  const response = await apiFetch(`/escala/excecoes/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error('Não foi possível remover a exceção')
  }
}

export async function buscarEscalaEfetiva(inicio: string, fim: string): Promise<DiaEfetivo[]> {
  const response = await apiFetch(`/escala/efetiva?inicio=${inicio}&fim=${fim}`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar a escala do período')
  }
  return response.json()
}

export async function buscarEscalaDaEquipe(inicio: string, fim: string): Promise<EscalaEquipe[]> {
  const response = await apiFetch(`/escala/equipe?inicio=${inicio}&fim=${fim}`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar a escala da equipe')
  }
  return response.json()
}

export async function buscarEstadoGoogle(): Promise<EstadoGoogle> {
  const response = await apiFetch('/integracoes/google/estado')
  if (!response.ok) {
    throw new Error('Não foi possível consultar a conexão com o Google Agenda')
  }
  return response.json()
}

/** Devolve a URL de autorização - quem chama precisa fazer `window.location.href = url` (uma
 * navegação de página inteira de verdade, não dá pra ser só este fetch: a Google exige que o
 * próprio navegador do usuário visite a tela de consentimento dela). */
export async function iniciarConexaoGoogle(): Promise<string> {
  const response = await apiFetch('/integracoes/google/iniciar')
  if (!response.ok) {
    throw new Error('Não foi possível iniciar a conexão com o Google Agenda')
  }
  const dados: { url: string } = await response.json()
  return dados.url
}

export async function desconectarGoogle(): Promise<void> {
  const response = await apiFetch('/integracoes/google', { method: 'DELETE' })
  if (!response.ok) {
    throw new Error('Não foi possível desconectar do Google Agenda')
  }
}

export async function listarMinhasReunioes(inicio: string, fim: string): Promise<Reuniao[]> {
  const response = await apiFetch(`/escala/reunioes?inicio=${inicio}&fim=${fim}`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar as reuniões')
  }
  return response.json()
}

export async function listarReunioesDaEquipe(inicio: string, fim: string): Promise<Reuniao[]> {
  const response = await apiFetch(`/escala/reunioes/equipe?inicio=${inicio}&fim=${fim}`)
  if (!response.ok) {
    throw new Error('Não foi possível carregar as reuniões da equipe')
  }
  return response.json()
}

/** Ver javadoc de `Disponibilidade` (types.ts) e de `EscalaService#consultarDisponibilidade` no
 * backend - checagem leve, aberta a qualquer autenticado, pra `MarcarReuniaoComMeetModal` avisar
 * antes de enviar se algum participante não trabalha na data escolhida. */
export async function consultarDisponibilidade(usuarioIds: number[], data: string): Promise<Disponibilidade[]> {
  const parametros = new URLSearchParams({ data })
  usuarioIds.forEach((id) => parametros.append('usuarioIds', String(id)))
  const response = await apiFetch(`/escala/disponibilidade?${parametros.toString()}`)
  if (!response.ok) {
    throw new Error('Não foi possível consultar a disponibilidade dos participantes')
  }
  return response.json()
}

export async function criarReuniao(dados: CriarReuniaoInput): Promise<Reuniao> {
  const response = await apiFetch('/escala/reunioes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  })
  if (!response.ok) {
    // pedido do usuário: link de Meet exige que o criador tenha conectado o Google - 428 é o
    // backend dizendo especificamente isso (`GoogleNaoConectadoException`), distinto de um erro
    // de horário/validação comum.
    if (response.status === 428) {
      throw new Error('Conecte sua conta do Google Agenda antes de marcar uma reunião com Meet')
    }
    // pedido do usuário: "Não consegui marcar a reunião!!" - a causa mais comum (horário fora do
    // expediente de um participante) agora é avisada antes de enviar (`consultarDisponibilidade`);
    // o que sobra aqui é sobretudo conflito com outra reunião já marcada, que não dá pra prever no
    // formulário sem consultar a agenda inteira de cada participante.
    throw new Error('Não foi possível marcar a reunião - algum participante já deve ter outro compromisso nesse horário')
  }
  return response.json()
}

export async function removerReuniao(id: number): Promise<void> {
  const response = await apiFetch(`/escala/reunioes/${id}`, { method: 'DELETE' })
  if (!response.ok) {
    throw new Error('Não foi possível cancelar a reunião')
  }
}
