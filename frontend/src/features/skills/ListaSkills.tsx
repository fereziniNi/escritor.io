import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { baixarOficiais, listarSkills } from './api'
import './skills.css'
import { CATEGORIAS, ROTULO_CATEGORIA, type Categoria } from './types'

/**
 * Lista do catálogo de Skills: busca, filtro por categoria, "Só oficiais" e download em lote das
 * oficiais. "Aprovações" só aparece para quem pode aprovar (GESTOR/ADMIN).
 */
export function ListaSkills({
  aoAbrir,
  aoNova,
  aoAprovacoes,
  podeAprovar,
}: {
  aoAbrir: (slug: string) => void
  aoNova: () => void
  aoAprovacoes: () => void
  podeAprovar: boolean
}) {
  const [busca, setBusca] = useState('')
  const [buscaDebounced, setBuscaDebounced] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca), 300)
    return () => clearTimeout(t)
  }, [busca])
  const [categoria, setCategoria] = useState<Categoria | ''>('')
  const [soOficiais, setSoOficiais] = useState(false)
  const [arquivadas, setArquivadas] = useState(false)

  const filtro = { busca: buscaDebounced.trim() || undefined, categoria: categoria || undefined, soOficiais, arquivadas }
  const query = useQuery({ queryKey: ['skills', filtro], queryFn: () => listarSkills(filtro), placeholderData: keepPreviousData })
  const download = useMutation({ mutationFn: baixarOficiais })

  return (
    <div className="skills-lista">
      <div className="linha-botoes">
        <button type="button" onClick={aoNova}>
          Nova skill
        </button>
        <button type="button" className="botao-secundario" onClick={() => download.mutate()} disabled={download.isPending}>
          Baixar todas as oficiais
        </button>
        {podeAprovar && (
          <button type="button" className="botao-secundario" onClick={aoAprovacoes}>
            Aprovações
          </button>
        )}
      </div>

      <div className="skills-filtros">
        <input type="search" aria-label="Buscar skills" placeholder="Buscar skills" value={busca} onChange={(e) => setBusca(e.target.value)} />
        <select aria-label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria | '')}>
          <option value="">Todas as categorias</option>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {ROTULO_CATEGORIA[c]}
            </option>
          ))}
        </select>
        <label>
          <input type="checkbox" checked={soOficiais} onChange={(e) => setSoOficiais(e.target.checked)} /> Só oficiais
        </label>
        <label>
          <input type="checkbox" checked={arquivadas} onChange={(e) => setArquivadas(e.target.checked)} /> Arquivadas
        </label>
      </div>

      {download.isError && <p className="mensagem-erro">Não foi possível baixar as skills oficiais.</p>}
      {query.isPending && <p className="mensagem-carregando">Carregando...</p>}
      {query.isError && <p className="mensagem-erro">Não foi possível carregar as skills.</p>}
      {query.data && query.data.length === 0 && <p className="mensagem-vazia">Nenhuma skill encontrada.</p>}
      {query.data && query.data.length > 0 && (
        <ul className="lista-cartoes">
          {query.data.map((s) => (
            <li key={s.slug} className="cartao-item">
              <button type="button" className="skills-cartao" onClick={() => aoAbrir(s.slug)}>
                <span className="cartao-item-cabecalho">
                  <span className="cartao-item-titulo">{s.nome}</span>
                  {s.oficial && <span className="badge">✅ Oficial Multiplica</span>}
                  {s.propostaPendente && <span className="badge badge-neutro">⏳ Proposta pendente</span>}
                  {s.arquivada && <span className="badge badge-neutro">Arquivada</span>}
                </span>
                <span className="cartao-item-corpo">{s.descricao}</span>
                <span className="cartao-item-meta">
                  {ROTULO_CATEGORIA[s.categoria]} · v{s.versaoVigente}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
