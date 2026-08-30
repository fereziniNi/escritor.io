import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, RefObject } from 'react'
import { HealthStatus } from '../../app/HealthStatus'
import { useAuthStore } from '../auth/authStore'
import { EquipesPage } from '../organizacao/EquipesPage'
import { ProjetosPage } from '../organizacao/ProjetosPage'
import { RelatoriosPage } from '../relatorios/RelatoriosPage'
import { buscarMapaAtivo } from './api'
import './EscritorioPage.css'
import { COR_STATUS, ICONE_STATUS, ICONE_ZONA, PROPS_ZONA } from './icones'
import { ListaPresenca } from './ListaPresenca'
import { PainelFlutuante } from './PainelFlutuante'
import { PainelKanban } from './PainelKanban'
import { PainelPonto } from './PainelPonto'
import { PixelCharacterSvg } from './PixelCharacterSvg'
import { OPCOES_STATUS, ROTULO_STATUS } from './statusAvatar'
import { SugestaoRegistrarEntrada } from './SugestaoRegistrarEntrada'
import { usePresencaWebSocket } from './usePresencaWebSocket'
import type { EstadoPresencaUsuario, StatusAvatar, TipoZona } from './types'

type PainelId = 'ponto' | 'kanban' | 'relatorios' | 'equipes' | 'projetos'

const TITULO_PAINEL: Record<PainelId, string> = {
  ponto: '⏱️ Ponto',
  kanban: '📋 Quadros',
  relatorios: '📊 Relatórios',
  equipes: '👥 Equipes',
  projetos: '📁 Projetos',
}

/** Usado como valor inicial/fallback (inclusive em teste, onde `ResizeObserver` não existe no
 * jsdom) - o tamanho real vem de `useTamanhoTileResponsivo` quando há um `ResizeObserver` de
 * verdade medindo o espaço disponível. */
const TAMANHO_TILE_PADRAO_PX = 40
const TAMANHO_TILE_MINIMO_PX = 24
const TAMANHO_TILE_MAXIMO_PX = 72

const TECLA_PARA_DELTA: Record<string, readonly [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
}

const COR_POR_TIPO_ZONA: Record<TipoZona, string> = {
  FOCO: '#bfe3c4',
  REUNIAO: '#bfd6ec',
  CAFE: '#eccfa8',
  ATENDIMENTO: '#eac1c8',
  LIVRE: '#dbe8d6',
}

/** Rastreia pra qual lado o personagem andou por último e se está em movimento agora, só a
 * partir da posição que o servidor manda - sem sprite sheet de caminhada de verdade, é uma
 * inferência visual (delta de x entre um render e outro), suficiente pra dar vida ao personagem. */
function useAnimacaoPersonagem(x: number) {
  const xAnteriorRef = useRef(x)
  const [direcao, setDirecao] = useState<'esquerda' | 'direita'>('direita')
  const [andando, setAndando] = useState(false)

  useEffect(() => {
    const anterior = xAnteriorRef.current
    xAnteriorRef.current = x
    if (x === anterior) {
      return undefined
    }
    setDirecao(x < anterior ? 'esquerda' : 'direita')
    setAndando(true)
    const timeout = setTimeout(() => setAndando(false), 260)
    return () => clearTimeout(timeout)
  }, [x])

  return { direcao, andando }
}

function AvatarNoMapa({ usuario, ehEu, tamanhoTile }: { usuario: EstadoPresencaUsuario; ehEu: boolean; tamanhoTile: number }) {
  const { direcao, andando } = useAnimacaoPersonagem(usuario.x)

  return (
    <div
      className="escritorio-avatar"
      data-testid={`avatar-${usuario.usuarioId}`}
      title={`${usuario.nome} - ${ROTULO_STATUS[usuario.status]}`}
      style={{
        left: usuario.x * tamanhoTile,
        top: usuario.y * tamanhoTile,
        width: tamanhoTile,
      }}
    >
      <span className="escritorio-personagem-corpo">
        <PixelCharacterSvg corCorpo={COR_STATUS[usuario.status]} direcao={direcao} andando={andando} destaque={ehEu} />
        <span className="escritorio-avatar-status">{ICONE_STATUS[usuario.status]}</span>
      </span>
      <span className="escritorio-avatar-nome">{usuario.nome}</span>
    </div>
  )
}

/**
 * Tamanho de tile responsivo: mede quanto espaço `.escritorio-coluna-mapa` tem disponível (o
 * dock/sidebar já ocupam o resto via flexbox) e escolhe o maior tile que ainda cabe o mapa
 * inteiro sem cortar, dentro de um mínimo/máximo razoável - assim o mapa realmente preenche a
 * janela em telas grandes, em vez de ficar um retângulo pequeno flutuando no meio de um espaço
 * vazio. Sem `ResizeObserver` (jsdom nos testes, ou um navegador muito antigo) fica no valor
 * padrão fixo - mesmo tamanho que a página sempre teve, então nenhuma asserção de pixel exato
 * nos testes muda.
 */
function useTamanhoTileResponsivo(containerRef: RefObject<HTMLDivElement | null>, larguraTiles: number, alturaTiles: number) {
  const [tamanho, setTamanho] = useState(TAMANHO_TILE_PADRAO_PX)

  useEffect(() => {
    const elemento = containerRef.current
    if (!elemento || typeof ResizeObserver === 'undefined') {
      return undefined
    }

    const observer = new ResizeObserver((entradas) => {
      const entrada = entradas[0]
      if (!entrada) {
        return
      }
      const { width, height } = entrada.contentRect
      if (width <= 0 || height <= 0) {
        return
      }
      const calculado = Math.floor(Math.min(width / larguraTiles, height / alturaTiles))
      setTamanho(Math.max(TAMANHO_TILE_MINIMO_PX, Math.min(TAMANHO_TILE_MAXIMO_PX, calculado)))
    })
    observer.observe(elemento)
    return () => observer.disconnect()
  }, [containerRef, larguraTiles, alturaTiles])

  return tamanho
}

/**
 * Renderização com `<div>`s/SVG posicionados via `position: absolute` em vez de um `<canvas>`
 * completo (PRD §6 deixa a escolha em aberto: "react-konva ou canvas puro"): jsdom não implementa
 * um canvas 2D de verdade, e testar via DOM real é consistente com o resto do projeto - sem
 * precisar de uma dependência nova (biblioteca de jogo/sprite sheet) só pra viabilizar teste.
 * `PixelCharacterSvg` desenha o personagem em SVG puro (retângulos com contorno), então dá pra ter
 * um visual bem mais próximo de "gente de verdade" que um círculo, sem nenhum asset de imagem.
 *
 * Movimento por seta atualiza a posição local de imediato via `mover` (predição, S6.4/PRD) - o
 * clamp contra `larguraTiles`/`alturaTiles` aqui é só uma cortesia visual (o servidor já valida
 * de verdade e ignora silenciosamente qualquer posição fora dos limites, ver
 * `ValidadorPosicaoMapa`). O visual (piso de madeira, sala mobiliada, personagem, dock de status)
 * é puramente decorativo - `left`/`top`/`data-testid`/`title` continuam sendo os únicos contratos
 * que os testes e o resto do app dependem.
 */
export function EscritorioPage() {
  const mapaQuery = useQuery({ queryKey: ['mapas', 'ativo'], queryFn: buscarMapaAtivo })
  const { usuarios, meuUsuarioId, mover, definirStatus } = usePresencaWebSocket()
  const papel = useAuthStore((estado) => estado.papel)
  const [painelAberto, setPainelAberto] = useState<PainelId | null>(null)
  const colunaMapaRef = useRef<HTMLDivElement>(null)
  const tamanhoTile = useTamanhoTileResponsivo(colunaMapaRef, mapaQuery.data?.larguraTiles ?? 1, mapaQuery.data?.alturaTiles ?? 1)

  useEffect(() => {
    const mapa = mapaQuery.data
    if (!mapa || meuUsuarioId === null) {
      return undefined
    }

    function aoPressionarTecla(evento: KeyboardEvent) {
      // com um painel aberto (formulário, board etc.), as setas são do painel, não do personagem
      if (painelAberto !== null) {
        return
      }
      const delta = TECLA_PARA_DELTA[evento.key]
      if (!delta || !mapa) {
        return
      }
      evento.preventDefault()
      const eu = usuarios[meuUsuarioId!]
      const novoX = Math.min(Math.max((eu?.x ?? 0) + delta[0], 0), mapa.larguraTiles - 1)
      const novoY = Math.min(Math.max((eu?.y ?? 0) + delta[1], 0), mapa.alturaTiles - 1)
      mover(novoX, novoY)
    }

    window.addEventListener('keydown', aoPressionarTecla)
    return () => window.removeEventListener('keydown', aoPressionarTecla)
  }, [mapaQuery.data, meuUsuarioId, usuarios, mover, painelAberto])

  if (mapaQuery.isPending) {
    return <p>Carregando…</p>
  }

  if (mapaQuery.isError) {
    return <p>Não foi possível carregar o mapa.</p>
  }

  const mapa = mapaQuery.data
  const meuStatus = meuUsuarioId !== null ? usuarios[meuUsuarioId]?.status : undefined

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
        <PainelFlutuante titulo={TITULO_PAINEL[painelAberto]} aoFechar={() => setPainelAberto(null)}>
          {painelAberto === 'ponto' && <PainelPonto />}
          {painelAberto === 'kanban' && <PainelKanban />}
          {painelAberto === 'relatorios' && <RelatoriosPage />}
          {painelAberto === 'equipes' && <EquipesPage />}
          {painelAberto === 'projetos' && <ProjetosPage />}
        </PainelFlutuante>
      )}

      <div className="escritorio-layout">
        <div className="escritorio-coluna-mapa" ref={colunaMapaRef}>
          <div className="escritorio-mapa-moldura">
            <div
              className="escritorio-mapa"
              data-testid="mapa"
              style={
                {
                  width: mapa.larguraTiles * tamanhoTile,
                  height: mapa.alturaTiles * tamanhoTile,
                  '--tamanho-tile': `${tamanhoTile}px`,
                } as CSSProperties
              }
            >
              {mapa.zonas.map((zona) => (
                <div
                  key={zona.id}
                  className="escritorio-zona"
                  title={zona.nome}
                  data-testid={`zona-${zona.id}`}
                  style={{
                    left: zona.x * tamanhoTile,
                    top: zona.y * tamanhoTile,
                    width: zona.largura * tamanhoTile,
                    height: zona.altura * tamanhoTile,
                    background: COR_POR_TIPO_ZONA[zona.tipo],
                  }}
                >
                  <span className="escritorio-zona-rotulo">
                    <span className="escritorio-zona-icone">{ICONE_ZONA[zona.tipo]}</span>
                    <span>{zona.nome}</span>
                  </span>
                  <span className="escritorio-zona-props">
                    {PROPS_ZONA[zona.tipo].map((prop) => (
                      <span key={prop}>{prop}</span>
                    ))}
                  </span>
                </div>
              ))}

              {Object.values(usuarios).map((usuario) => (
                <AvatarNoMapa key={usuario.usuarioId} usuario={usuario} ehEu={usuario.usuarioId === meuUsuarioId} tamanhoTile={tamanhoTile} />
              ))}
            </div>
          </div>
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
