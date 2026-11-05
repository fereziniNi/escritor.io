import { apiFetch } from '../../shared/api/http'
import { dispararDownload } from '../../shared/dispararDownload'
import type {
  CriarSkillRequest,
  FiltroSkills,
  Proposta,
  SalvarVersaoRequest,
  SkillDetalhe,
  SkillResumo,
  SkillVersao,
  VersaoResumo,
} from './types'

/** Erro 400/409 do módulo: `mensagem` vem do corpo `{"mensagem": "..."}` para o front exibir. */
export class ErroSkill extends Error {
  readonly mensagem: string
  readonly status: number

  constructor(mensagem: string, status: number) {
    super(mensagem)
    this.name = 'ErroSkill'
    this.mensagem = mensagem
    this.status = status
  }
}

async function garantirOk(response: Response, padrao: string): Promise<void> {
  if (response.ok) {
    return
  }
  if (response.status === 400 || response.status === 409) {
    const corpo = (await response.json().catch(() => null)) as { mensagem?: string } | null
    throw new ErroSkill(corpo?.mensagem ?? padrao, response.status)
  }
  throw new Error(padrao)
}

async function json<T>(response: Response, padrao: string): Promise<T> {
  await garantirOk(response, padrao)
  return response.json()
}

const enc = encodeURIComponent
const JSON_HEADERS = { 'Content-Type': 'application/json' }

export async function listarSkills(filtro: FiltroSkills = {}): Promise<SkillResumo[]> {
  const params = new URLSearchParams()
  if (filtro.busca) params.set('busca', filtro.busca)
  if (filtro.categoria) params.set('categoria', filtro.categoria)
  if (filtro.soOficiais) params.set('oficial', 'true')
  if (filtro.arquivadas) params.set('arquivadas', 'true')
  const query = params.toString()
  return json(await apiFetch(query ? `/skills?${query}` : '/skills'), 'Não foi possível carregar as skills')
}

export async function buscarSkill(slug: string): Promise<SkillDetalhe> {
  return json(await apiFetch(`/skills/${enc(slug)}`), 'Não foi possível carregar a skill')
}

export async function listarVersoes(slug: string): Promise<VersaoResumo[]> {
  return json(await apiFetch(`/skills/${enc(slug)}/versoes`), 'Não foi possível carregar as versões')
}

export async function buscarVersao(slug: string, numero: number): Promise<SkillVersao> {
  return json(await apiFetch(`/skills/${enc(slug)}/versoes/${numero}`), 'Não foi possível carregar a versão')
}

export async function criarSkill(req: CriarSkillRequest): Promise<SkillVersao> {
  const response = await apiFetch('/skills', { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(req) })
  return json(response, 'Não foi possível criar a skill')
}

export async function salvarVersao(slug: string, req: SalvarVersaoRequest): Promise<SkillVersao> {
  const response = await apiFetch(`/skills/${enc(slug)}/versoes`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(req),
  })
  return json(response, 'Não foi possível salvar a versão')
}

export async function restaurarVersao(slug: string, numero: number): Promise<SkillVersao> {
  const response = await apiFetch(`/skills/${enc(slug)}/versoes/${numero}/restaurar`, { method: 'POST' })
  return json(response, 'Não foi possível restaurar a versão')
}

export async function aprovar(slug: string, numero: number): Promise<SkillVersao> {
  const response = await apiFetch(`/skills/${enc(slug)}/versoes/${numero}/aprovar`, { method: 'POST' })
  return json(response, 'Não foi possível aprovar a proposta')
}

export async function rejeitar(slug: string, numero: number, motivo: string): Promise<SkillVersao> {
  const response = await apiFetch(`/skills/${enc(slug)}/versoes/${numero}/rejeitar`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ motivo }),
  })
  return json(response, 'Não foi possível rejeitar a proposta')
}

export async function definirOficial(slug: string, valor: boolean): Promise<void> {
  const response = await apiFetch(`/skills/${enc(slug)}/oficial`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ valor }),
  })
  await garantirOk(response, 'Não foi possível alterar o selo oficial')
}

export async function definirArquivada(slug: string, valor: boolean): Promise<void> {
  const response = await apiFetch(`/skills/${enc(slug)}/arquivada`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ valor }),
  })
  await garantirOk(response, 'Não foi possível alterar o arquivamento')
}

export async function listarPropostas(): Promise<Proposta[]> {
  return json(await apiFetch('/skills/propostas'), 'Não foi possível carregar as propostas')
}

export function urlZip(slug: string, numero?: number): string {
  return numero === undefined ? `/skills/${enc(slug)}/zip` : `/skills/${enc(slug)}/zip?versao=${numero}`
}

async function baixar(url: string, nomeArquivo: string): Promise<void> {
  const response = await apiFetch(url)
  await garantirOk(response, 'Não foi possível baixar o arquivo')
  dispararDownload(await response.blob(), nomeArquivo)
}

export function baixarZip(slug: string, numero?: number): Promise<void> {
  return baixar(urlZip(slug, numero), `${slug}.zip`)
}

export function baixarOficiais(): Promise<void> {
  return baixar('/skills/oficiais.zip', 'skills-oficiais-multiplica.zip')
}
