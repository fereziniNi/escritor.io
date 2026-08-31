import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { HealthStatus } from '../../app/HealthStatus'
import { useAuthStore } from '../auth/authStore'
import { EquipesPage } from '../organizacao/EquipesPage'
import { ProjetosPage } from '../organizacao/ProjetosPage'
import { RelatoriosPage } from '../relatorios/RelatoriosPage'
import { buscarMapaAtivo } from './api'
import './EscritorioPage.css'
import { ICONE_STATUS } from './icones'
import { ListaPresenca } from './ListaPresenca'
import { CamadaMundo } from './mundo/CamadaMundo'
import { useMovimentoTeclado } from './mundo/useMovimentoTeclado'
import { PainelFlutuante } from './PainelFlutuante'
import { PainelKanban } from './PainelKanban'
import { PainelPonto } from './PainelPonto'
import { OPCOES_STATUS, ROTULO_STATUS } from './statusAvatar'
import { SugestaoRegistrarEntrada } from './SugestaoRegistrarEntrada'
import { usePresencaWebSocket } from './usePresencaWebSocket'
import type { StatusAvatar } from './types'

type PainelId = 'ponto' | 'kanban' | 'relatorios' | 'equipes' | 'projetos'

const TITULO_PAINEL: Record<PainelId, string> = {
  ponto: '⏱️ Ponto',
  kanban: '📋 Quadros',
  relatorios: '📊 Relatórios',
  equipes: '👥 Equipes',
  projetos: '📁 Projetos',
}

/**
 * O mundo (piso/paredes/móveis/avatares/câmera) é desenhado num canvas Pixi via `CamadaMundo`
 * (redesign estilo Gather, ver plano em `.claude/plans/splendid-percolating-mochi.md`) - substitui
 * a renderização anterior em `<div>`s posicionados por CSS. O HUD ao redor (título, dock, painéis,
 * lista de presença) continua em DOM/React normal, só o mundo em si migrou.
 */
export function EscritorioPage() {
  const mapaQuery = useQuery({ queryKey: ['mapas', 'ativo'], queryFn: buscarMapaAtivo })
  const { usuarios, meuUsuarioId, mover, definirStatus } = usePresencaWebSocket()
  const papel = useAuthStore((estado) => estado.papel)
  const [painelAberto, setPainelAberto] = useState<PainelId | null>(null)

  const eu = meuUsuarioId !== null ? usuarios[meuUsuarioId] : undefined

  useMovimentoTeclado({
    // com um painel aberto (formulário, board etc.), as setas são do painel, não do personagem
    ativo: painelAberto === null,
    posicaoAtual: eu ? { x: eu.x, y: eu.y } : undefined,
    limites: { larguraTiles: mapaQuery.data?.larguraTiles ?? 1, alturaTiles: mapaQuery.data?.alturaTiles ?? 1 },
    mover,
  })

  if (mapaQuery.isPending) {
    return <p>Carregando…</p>
  }

  if (mapaQuery.isError) {
    return <p>Não foi possível carregar o mapa.</p>
  }

  const mapa = mapaQuery.data
  const meuStatus = eu?.status

  return (
    <section className="escritorio-pagina">
      <h2 className="escritorio-titulo fonte-jogo">🏢 {mapa.nome}</h2>
      <SugestaoRegistrarEntrada aoClicarRegistrar={() => setPainelAberto('ponto')} />

      <div className="escritorio-dock">
        <span className="escritorio-dock-rotulo">Meu status</span>
        <select
          aria-label="Status"
          value={meuStatus ?? 'DISPONIVEL'}
          onChange={(evento) => definirStatus(evento.target.value as StatusAvatar)}
        >
          {OPCOES_STATUS.map((status) => (
            <option key={status} value={status}>
              {ICONE_STATUS[status]} {ROTULO_STATUS[status]}
            </option>
          ))}
        </select>

        <span className="escritorio-dock-separador" />

        <button type="button" className="escritorio-dock-botao" onClick={() => setPainelAberto('ponto')}>
          ⏱️ Ponto
        </button>
        <button type="button" className="escritorio-dock-botao" onClick={() => setPainelAberto('kanban')}>
          📋 Quadros
        </button>
        {(papel === 'GESTOR' || papel === 'ADMIN') && (
          <button type="button" className="escritorio-dock-botao" onClick={() => setPainelAberto('relatorios')}>
            📊 Relatórios
          </button>
        )}
        {papel === 'ADMIN' && (
          <>
            <button type="button" className="escritorio-dock-botao" onClick={() => setPainelAberto('equipes')}>
              👥 Equipes
            </button>
            <button type="button" className="escritorio-dock-botao" onClick={() => setPainelAberto('projetos')}>
              📁 Projetos
            </button>
          </>
        )}

        <span className="escritorio-dock-dica">⬅️⬆️➡️⬇️ pra andar</span>
      </div>

      {painelAberto && (
        <PainelFlutuante
          titulo={TITULO_PAINEL[painelAberto]}
          aoFechar={() => setPainelAberto(null)}
          largo={painelAberto === 'kanban'}
        >
          {painelAberto === 'ponto' && <PainelPonto />}
          {painelAberto === 'kanban' && <PainelKanban />}
          {painelAberto === 'relatorios' && <RelatoriosPage />}
          {painelAberto === 'equipes' && <EquipesPage />}
          {painelAberto === 'projetos' && <ProjetosPage />}
        </PainelFlutuante>
      )}

      <div className="escritorio-layout">
        <div className="escritorio-coluna-mapa">
          <CamadaMundo
            larguraTiles={mapa.larguraTiles}
            alturaTiles={mapa.alturaTiles}
            zonas={mapa.zonas}
            usuarios={Object.values(usuarios)}
            meuUsuarioId={meuUsuarioId}
          />
        </div>

        <div className="escritorio-coluna-lista">
          <ListaPresenca zonas={mapa.zonas} usuarios={Object.values(usuarios)} meuUsuarioId={meuUsuarioId} />
        </div>
      </div>

      <div className="escritorio-rodape">
        <HealthStatus />
      </div>
    </section>
  )
}
