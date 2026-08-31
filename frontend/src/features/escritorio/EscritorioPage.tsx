import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { HealthStatus } from '../../app/HealthStatus'
import { useAuthStore } from '../auth/authStore'
import { EquipesPage } from '../organizacao/EquipesPage'
import { ProjetosPage } from '../organizacao/ProjetosPage'
import { RelatoriosPage } from '../relatorios/RelatoriosPage'
import { buscarMapaAtivo } from './api'
import './EscritorioPage.css'
import './ui/hud.css'
import { CamadaMundo } from './mundo/CamadaMundo'
import { PROXIMIDADE_RAIO_TILES } from './mundo/constantes'
import { construirGradeColisao } from './mundo/construirGradeColisao'
import { PORTAS_OVERRIDE } from './mundo/dadosMundo'
import { gerarParedesDeZona } from './mundo/gerarParedesDeZona'
import { calcularParesProximos, usuariosProximosDeAlguem } from './mundo/proximidade'
import { useMovimentoTeclado } from './mundo/useMovimentoTeclado'
import { PainelFlutuante } from './PainelFlutuante'
import { PainelKanban } from './PainelKanban'
import { PainelPonto } from './PainelPonto'
import { SugestaoRegistrarEntrada } from './SugestaoRegistrarEntrada'
import type { PainelId } from './ui/BarraFerramentas'
import { BarraFerramentas } from './ui/BarraFerramentas'
import { Notificacoes } from './ui/Notificacao'
import { PainelLateral } from './ui/PainelLateral'
import { useNotificacoes } from './ui/useNotificacoes'
import { usePresencaWebSocket } from './usePresencaWebSocket'

const TITULO_PAINEL: Record<PainelId, string> = {
  ponto: '⏱️ Ponto',
  kanban: '📋 Quadros',
  relatorios: '📊 Relatórios',
  equipes: '👥 Equipes',
  projetos: '📁 Projetos',
}

/**
 * O mundo (piso/paredes/móveis/avatares/câmera) é desenhado num canvas Pixi via `CamadaMundo`
 * (redesign estilo Gather, ver plano em `.claude/plans/splendid-percolating-mochi.md`). O HUD ao
 * redor virou uma toolbar inferior (`BarraFerramentas`) + um drawer de participantes recolhível
 * (`PainelLateral`) + uma pilha de notificações (`Notificacoes`) - mais perto da proporção e do
 * comportamento do dock/painel do Gather do que a barra sempre-visível de antes.
 */
export function EscritorioPage() {
  const mapaQuery = useQuery({ queryKey: ['mapas', 'ativo'], queryFn: buscarMapaAtivo })
  const { usuarios, meuUsuarioId, mover, definirStatus } = usePresencaWebSocket()
  const papel = useAuthStore((estado) => estado.papel)
  const [painelAberto, setPainelAberto] = useState<PainelId | null>(null)
  const [participantesAberto, setParticipantesAberto] = useState(false)
  const { itens: notificacoes, notificar } = useNotificacoes()

  const eu = meuUsuarioId !== null ? usuarios[meuUsuarioId] : undefined

  // colisão client-side (Fase 3): paredes derivadas das zonas, mesma fonte que CamadaMundo usa
  // pra desenhar - o cliente se recusa a *iniciar* um movimento pra dentro de uma parede, mas o
  // servidor (ValidadorPosicaoMapa) continua só validando o retângulo externo do mapa, não paredes
  // - limitação real e documentada, não um substituto de validação de servidor.
  const paredes = useMemo(() => gerarParedesDeZona(mapaQuery.data?.zonas ?? [], PORTAS_OVERRIDE), [mapaQuery.data?.zonas])
  const transicaoBloqueada = useMemo(() => construirGradeColisao(paredes), [paredes])

  useMovimentoTeclado({
    // com um painel aberto (formulário, board etc.), as setas são do painel, não do personagem
    ativo: painelAberto === null,
    posicaoAtual: eu ? { x: eu.x, y: eu.y } : undefined,
    limites: { larguraTiles: mapaQuery.data?.larguraTiles ?? 1, alturaTiles: mapaQuery.data?.alturaTiles ?? 1 },
    mover,
    transicaoBloqueada,
  })

  // proximidade (Fase 3): calculada a partir da posição real em tile, não de posição de tela -
  // usada pro destaque na lista lateral, pro brilho no mundo Pixi (dentro de CamadaMundo, que
  // recalcula por conta própria a partir dos mesmos `usuarios`) e pro toast abaixo.
  const usuariosLista = useMemo(() => Object.values(usuarios), [usuarios])
  const pares = useMemo(() => calcularParesProximos(usuariosLista, PROXIMIDADE_RAIO_TILES), [usuariosLista])
  const proximos = useMemo(() => usuariosProximosDeAlguem(pares), [pares])

  // notifica só a *transição* de entrar em proximidade de alguém (não fica repetindo a cada
  // render enquanto os dois continuam parados perto um do outro).
  const paresNotificadosRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (meuUsuarioId === null) {
      return
    }
    const chaves = new Set<string>()
    for (const par of pares) {
      const chave = `${par.usuarioIdA}-${par.usuarioIdB}`
      chaves.add(chave)
      const souEuNoPar = par.usuarioIdA === meuUsuarioId || par.usuarioIdB === meuUsuarioId
      if (souEuNoPar && !paresNotificadosRef.current.has(chave)) {
        const outroId = par.usuarioIdA === meuUsuarioId ? par.usuarioIdB : par.usuarioIdA
        const outro = usuarios[outroId]
        if (outro) {
          notificar(`${outro.nome} está por perto`)
        }
      }
    }
    paresNotificadosRef.current = chaves
  }, [pares, meuUsuarioId, usuarios, notificar])

  if (mapaQuery.isPending) {
    return <p>Carregando…</p>
  }

  if (mapaQuery.isError) {
    return <p>Não foi possível carregar o mapa.</p>
  }

  const mapa = mapaQuery.data
  const meuStatus = eu?.status ?? 'DISPONIVEL'

  return (
    <section className="escritorio-pagina">
      <h2 className="escritorio-titulo fonte-jogo">🏢 {mapa.nome}</h2>
      <SugestaoRegistrarEntrada aoClicarRegistrar={() => setPainelAberto('ponto')} />
      <Notificacoes itens={notificacoes} />

      <BarraFerramentas
        nome={eu?.nome ?? 'Você'}
        meuStatus={meuStatus}
        aoMudarStatus={definirStatus}
        papel={papel}
        painelAberto={painelAberto}
        aoAbrirPainel={setPainelAberto}
        participantesAberto={participantesAberto}
        aoAlternarParticipantes={() => setParticipantesAberto((atual) => !atual)}
      />

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
            usuarios={usuariosLista}
            meuUsuarioId={meuUsuarioId}
          />
        </div>

        <PainelLateral
          aberto={participantesAberto}
          zonas={mapa.zonas}
          usuarios={usuariosLista}
          meuUsuarioId={meuUsuarioId}
          usuariosProximos={proximos}
        />
      </div>

      <div className="escritorio-rodape">
        <HealthStatus />
      </div>
    </section>
  )
}
