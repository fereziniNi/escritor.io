import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { HealthStatus } from '../../app/HealthStatus'
import { useAuthStore } from '../auth/authStore'
import { IntegracaoWhatsAppPage } from '../integracoes/IntegracaoWhatsAppPage'
import { ColaboradoresPage } from '../organizacao/ColaboradoresPage'
import { RelatoriosPage } from '../relatorios/RelatoriosPage'
import { buscarMapaAtivo } from './api'
import { APARENCIA_PADRAO } from './avatar/aparenciaAvatar'
import { EditorAvatarPage } from './avatar/EditorAvatarPage'
import { EscalaPage } from './EscalaPage'
import './EscritorioPage.css'
import './ui/hud.css'
import { CronometroTrabalho } from './CronometroTrabalho'
import { CamadaMundo } from './mundo/CamadaMundo'
import { PROXIMIDADE_RAIO_TILES } from './mundo/constantes'
import { calcularParesProximos, usuariosProximosDeAlguem } from './mundo/proximidade'
import { calcularDestinoParaStatus } from './mundo/statusParaZona'
import { useMovimentoTeclado } from './mundo/useMovimentoTeclado'
import { PainelFlutuante } from './PainelFlutuante'
import { PainelPonto } from './PainelPonto'
import { PainelProjetos } from './PainelProjetos'
import type { StatusAvatar } from './types'
import type { PainelId } from './ui/BarraFerramentas'
import { BarraFerramentas } from './ui/BarraFerramentas'
import { Notificacoes } from './ui/Notificacao'
import { PainelLateral } from './ui/PainelLateral'
import { useNotificacoes } from './ui/useNotificacoes'
import { usePresencaWebSocket } from './usePresencaWebSocket'

const TITULO_PAINEL: Record<PainelId, string> = {
  ponto: '⏱️ Ponto',
  escala: '🗓️ Minha escala',
  relatorios: '📊 Relatórios',
  projetos: '📁 Projetos',
  colaboradores: '🧑‍💼 Colaboradores',
  whatsapp: '📱 WhatsApp',
  avatar: '🧑‍🎨 Editar avatar',
}

/**
 * O mundo (piso/móveis/avatares/câmera) é desenhado num canvas Pixi via `CamadaMundo` (redesign
 * estilo Gather, ver plano em `.claude/plans/splendid-percolating-mochi.md`). Sem paredes/colisão
 * de propósito (pedido do usuário: "remover as paredes, deixar o mapa mais vivo") - o movimento
 * só é limitado pelos cantos do mapa (`useMovimentoTeclado`). O HUD ao redor virou uma toolbar
 * inferior (`BarraFerramentas`) + um drawer de participantes recolhível (`PainelLateral`) + uma
 * pilha de notificações (`Notificacoes`) - mais perto da proporção e do comportamento do
 * dock/painel do Gather do que a barra sempre-visível de antes.
 */
export function EscritorioPage() {
  const mapaQuery = useQuery({ queryKey: ['mapas', 'ativo'], queryFn: buscarMapaAtivo })
  const { usuarios, meuUsuarioId, mover, definirStatus } = usePresencaWebSocket()
  const papel = useAuthStore((estado) => estado.papel)
  const [painelAberto, setPainelAberto] = useState<PainelId | null>(null)
  const [participantesAberto, setParticipantesAberto] = useState(false)
  const { itens: notificacoes, notificar } = useNotificacoes()

  // Pedido do usuário: "algo muito parecido com o agenda do google... ou ate mesmo integrar" - a
  // Google redireciona o navegador de volta pra cá (`IntegracaoGoogleController#callback`, no
  // backend, devolve `/?google=conectado|erro`) depois do usuário autorizar. Lê o parâmetro uma
  // vez ao montar, mostra o toast, abre "Minha escala" (é lá que a conexão foi iniciada) e limpa a
  // URL - sem isso o parâmetro reapareceria num F5 e notificaria de novo.
  useEffect(() => {
    const parametros = new URLSearchParams(window.location.search)
    const google = parametros.get('google')
    if (google === 'conectado') {
      notificar('✅ Google Agenda conectado!')
      setPainelAberto('escala')
    } else if (google === 'erro') {
      notificar('Não foi possível conectar ao Google Agenda.')
      setPainelAberto('escala')
    }
    if (google !== null) {
      window.history.replaceState(null, '', window.location.pathname)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const eu = meuUsuarioId !== null ? usuarios[meuUsuarioId] : undefined

  useMovimentoTeclado({
    // com um painel aberto (formulário, board etc.), as setas são do painel, não do personagem
    ativo: painelAberto === null,
    posicaoAtual: eu ? { x: eu.x, y: eu.y } : undefined,
    limites: { larguraTiles: mapaQuery.data?.larguraTiles ?? 1, alturaTiles: mapaQuery.data?.alturaTiles ?? 1 },
    mover,
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

  // pedido do usuário: escolher um status redireciona o personagem pro lugar que o representa
  // (Área de trabalho/Sala de reunião/Café/Fora do trabalho) - `calcularDestinoParaStatus` decide
  // se existe destino (DISPONIVEL não tem, de propósito).
  function aoMudarStatus(status: StatusAvatar) {
    definirStatus(status)
    const destino = calcularDestinoParaStatus(mapa.zonas, status)
    if (destino) {
      mover(destino.x, destino.y)
    }
  }

  return (
    <section className="escritorio-pagina">
      <CronometroTrabalho />
      <Notificacoes itens={notificacoes} />

      <BarraFerramentas
        nome={eu?.nome ?? 'Você'}
        meuAparencia={eu?.aparencia ?? APARENCIA_PADRAO}
        meuStatus={meuStatus}
        aoMudarStatus={aoMudarStatus}
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
          largo={painelAberto === 'projetos' || painelAberto === 'escala'}
        >
          {painelAberto === 'ponto' && <PainelPonto />}
          {painelAberto === 'escala' && <EscalaPage />}
          {painelAberto === 'relatorios' && <RelatoriosPage />}
          {painelAberto === 'projetos' && <PainelProjetos />}
          {painelAberto === 'colaboradores' && <ColaboradoresPage />}
          {painelAberto === 'whatsapp' && <IntegracaoWhatsAppPage />}
          {painelAberto === 'avatar' && <EditorAvatarPage />}
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
