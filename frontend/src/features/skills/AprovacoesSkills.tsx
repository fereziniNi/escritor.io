import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { aprovar, buscarSkill, buscarVersao, ErroSkill, listarPropostas, rejeitar } from './api'
import { DiffArquivo } from './DiffArquivo'
import './skills.css'
import { ROTULO_CATEGORIA, type Proposta, type SkillVersao } from './types'

function mensagemDoErro(erro: unknown): string {
  return erro instanceof ErroSkill ? erro.mensagem : 'Não foi possível concluir a operação.'
}

/** Campos versionados além dos arquivos, comparados como texto. */
function camposTexto(v: SkillVersao): [string, string][] {
  return [
    ['Nome', v.nome],
    ['Descrição', v.descricao],
    ['Categoria', ROTULO_CATEGORIA[v.categoria]],
    ['Prompt de uso', v.promptUso ?? ''],
    ['Tutorial de instalação', v.tutorialInstalacao ?? ''],
  ]
}

function DiffProposta({ vigente, proposta }: { vigente: SkillVersao; proposta: SkillVersao }) {
  const camposAntes = camposTexto(vigente)
  const camposAlterados = camposTexto(proposta)
    .map(([rotulo, valor], i) => ({ rotulo, antes: camposAntes[i][1], depois: valor }))
    .filter((c) => c.antes !== c.depois)
  const antes = new Map(vigente.arquivos.map((a) => [a.caminho, a.conteudo]))
  const depois = new Map(proposta.arquivos.map((a) => [a.caminho, a.conteudo]))
  const caminhos = [...new Set([...antes.keys(), ...depois.keys()])].sort()
  const arquivosAlterados = caminhos.filter((c) => antes.get(c) !== depois.get(c))

  if (camposAlterados.length === 0 && arquivosAlterados.length === 0) {
    return <p className="mensagem-vazia">Nenhuma diferença em relação à versão vigente.</p>
  }
  return (
    <div className="diff-proposta">
      {camposAlterados.map((c) => (
        <DiffArquivo key={c.rotulo} caminho={c.rotulo} antes={c.antes} depois={c.depois} />
      ))}
      {arquivosAlterados.map((c) => (
        <DiffArquivo key={c} caminho={c} antes={antes.get(c) ?? null} depois={depois.get(c) ?? null} />
      ))}
    </div>
  )
}

function RevisaoProposta({ proposta, aoVoltar, aoDecidir }: { proposta: Proposta; aoVoltar: () => void; aoDecidir: () => void }) {
  const queryClient = useQueryClient()
  const vigenteQuery = useQuery({ queryKey: ['skills', 'detalhe', proposta.slug], queryFn: () => buscarSkill(proposta.slug) })
  const propostaQuery = useQuery({
    queryKey: ['skills', 'versao', proposta.slug, proposta.numero],
    queryFn: () => buscarVersao(proposta.slug, proposta.numero),
  })
  const [rejeitando, setRejeitando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erroMotivo, setErroMotivo] = useState(false)

  const aoConcluir = async () => {
    await queryClient.invalidateQueries({ queryKey: ['skills'] })
    aoDecidir()
  }
  const aprovarMut = useMutation({ mutationFn: () => aprovar(proposta.slug, proposta.numero), onSuccess: aoConcluir })
  const rejeitarMut = useMutation({ mutationFn: () => rejeitar(proposta.slug, proposta.numero, motivo.trim()), onSuccess: aoConcluir })
  const ocupado = aprovarMut.isPending || rejeitarMut.isPending
  const erro = aprovarMut.error ?? rejeitarMut.error

  const confirmarRejeicao = () => {
    if (!motivo.trim()) {
      setErroMotivo(true)
      return
    }
    setErroMotivo(false)
    rejeitarMut.mutate()
  }

  return (
    <div className="skills-aprovacao">
      <button type="button" className="botao-secundario" onClick={aoVoltar}>
        Voltar
      </button>
      <h2>{proposta.nomeSkill}</h2>
      <p className="cartao-item-meta">
        Versão {proposta.numero} proposta por {proposta.autorNome}
        {proposta.mensagem ? ` — ${proposta.mensagem}` : ''}
      </p>

      {(vigenteQuery.isPending || propostaQuery.isPending) && <p className="mensagem-carregando">Carregando...</p>}
      {(vigenteQuery.isError || propostaQuery.isError) && <p className="mensagem-erro">Não foi possível carregar as diferenças.</p>}
      {vigenteQuery.data && propostaQuery.data && <DiffProposta vigente={vigenteQuery.data.vigente} proposta={propostaQuery.data} />}

      {erro && (
        <p role="alert" className="mensagem-erro">
          {mensagemDoErro(erro)}
        </p>
      )}

      {rejeitando ? (
        <div className="skills-rejeicao">
          <label>
            Motivo da rejeição
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
          </label>
          {erroMotivo && <p className="mensagem-erro">Informe o motivo da rejeição.</p>}
          <div className="linha-botoes">
            <button type="button" onClick={confirmarRejeicao} disabled={ocupado}>
              Confirmar rejeição
            </button>
            <button type="button" className="botao-secundario" onClick={() => setRejeitando(false)} disabled={ocupado}>
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="linha-botoes">
          <button type="button" onClick={() => aprovarMut.mutate()} disabled={ocupado || !propostaQuery.data}>
            Aprovar
          </button>
          <button type="button" className="botao-secundario" onClick={() => setRejeitando(true)} disabled={ocupado}>
            Rejeitar
          </button>
        </div>
      )}
    </div>
  )
}

/** Fila de propostas pendentes (GESTOR/ADMIN) e revisão com diff contra a versão vigente. */
export function AprovacoesSkills({ aoVoltar }: { aoVoltar: () => void }) {
  const [aberta, setAberta] = useState<Proposta | null>(null)
  const query = useQuery({ queryKey: ['skills', 'propostas'], queryFn: listarPropostas })

  if (aberta) {
    return <RevisaoProposta proposta={aberta} aoVoltar={() => setAberta(null)} aoDecidir={() => setAberta(null)} />
  }

  return (
    <div className="skills-aprovacoes">
      <button type="button" className="botao-secundario" onClick={aoVoltar}>
        Voltar
      </button>
      <h2>Aprovações</h2>
      {query.isPending && <p className="mensagem-carregando">Carregando...</p>}
      {query.isError && <p className="mensagem-erro">Não foi possível carregar as propostas.</p>}
      {query.data?.length === 0 && <p className="mensagem-vazia">Nenhuma proposta pendente.</p>}
      <ul className="lista-cartoes">
        {query.data?.map((p) => (
          <li key={`${p.slug}-${p.numero}`} className="cartao-item">
            <button type="button" className="skills-cartao" onClick={() => setAberta(p)}>
              <span className="cartao-item-titulo">{p.nomeSkill}</span>
              <span className="cartao-item-meta">
                v{p.numero} · {p.autorNome}
                {p.mensagem ? ` · ${p.mensagem}` : ''}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
