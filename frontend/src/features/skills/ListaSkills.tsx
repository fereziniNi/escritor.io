import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { baixarOficiais, listarSkills } from './api'
import './skills.css'
import { CATEGORIAS, ROTULO_CATEGORIA, type Categoria } from './types'

function dataCurta(iso: string): string {
  const data = new Date(iso)
  return Number.isNaN(data.getTime()) ? '' : data.toLocaleDateString('pt-BR')
}

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
  const total = query.data?.length ?? 0

  return (
    <div className="skills-lista">
      <div className="skills-barra">
        <div className="skills-barra-topo">
          <div className="skills-busca">
            <span className="skills-busca-icone" aria-hidden="true">
              🔍
            </span>
            <input type="search" aria-label="Buscar skills" placeholder="Buscar por nome ou descrição" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <div className="skills-acoes">
            {podeAprovar && (
              <button type="button" className="skills-btn skills-btn-fantasma" onClick={aoAprovacoes}>
                Aprovações
              </button>
            )}
            <button type="button" className="skills-btn skills-btn-secundario" onClick={() => download.mutate()} disabled={download.isPending}>
              <span aria-hidden="true">⬇</span>
              Baixar todas as oficiais
            </button>
            <button type="button" className="skills-btn skills-btn-primario" onClick={aoNova}>
              <span aria-hidden="true">+</span>
              Nova skill
            </button>
          </div>
        </div>

        <div className="skills-filtros">
          <select aria-label="Categoria" value={categoria} onChange={(e) => setCategoria(e.target.value as Categoria | '')}>
            <option value="">Todas as categorias</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {ROTULO_CATEGORIA[c]}
              </option>
            ))}
          </select>
          <label className="skills-filtro-chip">
            <input type="checkbox" checked={soOficiais} onChange={(e) => setSoOficiais(e.target.checked)} /> Só oficiais
          </label>
          <label className="skills-filtro-chip">
            <input type="checkbox" checked={arquivadas} onChange={(e) => setArquivadas(e.target.checked)} /> Arquivadas
          </label>
          {query.data && (
            <span className="skills-contagem" aria-live="polite">
              {total === 1 ? '1 skill' : `${total} skills`}
            </span>
          )}
        </div>
      </div>

      {download.isError && <p className="mensagem-erro">Não foi possível baixar as skills oficiais.</p>}
      {query.isPending && (
        <>
          <p className="sr-only" role="status">
            Carregando...
          </p>
          <ul className="skills-esqueleto" aria-hidden="true">
            <li />
            <li />
            <li />
          </ul>
        </>
      )}
      {query.isError && (
        <div className="skills-estado">
          <p className="mensagem-erro">Não foi possível carregar as skills.</p>
          <button type="button" className="skills-btn skills-btn-secundario skills-btn-pequeno" onClick={() => query.refetch()}>
            Tentar de novo
          </button>
        </div>
      )}
      {query.data && query.data.length === 0 && (
        <div className="skills-estado">
          <p className="skills-estado-titulo">Nenhuma skill encontrada.</p>
          <p>Tente outra busca ou limpe os filtros.</p>
        </div>
      )}
      {query.data && query.data.length > 0 && (
        <ul className="skills-cartoes">
          {query.data.map((s) => (
            <li key={s.slug}>
              <button type="button" className="skills-cartao" onClick={() => aoAbrir(s.slug)}>
                <span className="skills-cartao-topo">
                  <span className="skills-cartao-titulo">{s.nome}</span>
                  {(s.oficial || s.propostaPendente || s.arquivada) && (
                    <span className="skills-chips">
                      {s.oficial && <span className="skills-chip skills-chip-oficial">✓ Oficial Multiplica</span>}
                      {s.propostaPendente && <span className="skills-chip skills-chip-pendente">⏳ Proposta pendente</span>}
                      {s.arquivada && <span className="skills-chip skills-chip-arquivada">Arquivada</span>}
                    </span>
                  )}
                </span>
                <span className="skills-cartao-descricao">{s.descricao}</span>
                <span className="skills-cartao-rodape">
                  <span className="skills-chip skills-chip-categoria">{ROTULO_CATEGORIA[s.categoria]}</span>
                  <span>v{s.versaoVigente}</span>
                  {dataCurta(s.atualizadaEm) && (
                    <>
                      <span className="skills-separador" aria-hidden="true">
                        ·
                      </span>
                      <span>Atualizada em {dataCurta(s.atualizadaEm)}</span>
                    </>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
