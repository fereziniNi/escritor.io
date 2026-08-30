import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { buscarMapaAtivo } from './api'
import './EscritorioPage.css'
import { COR_STATUS, ICONE_STATUS, ICONE_ZONA, PROPS_ZONA } from './icones'
import { ListaPresenca } from './ListaPresenca'
import { PixelCharacterSvg } from './PixelCharacterSvg'
import { OPCOES_STATUS, ROTULO_STATUS } from './statusAvatar'
import { SugestaoRegistrarEntrada } from './SugestaoRegistrarEntrada'
import { usePresencaWebSocket } from './usePresencaWebSocket'
import type { EstadoPresencaUsuario, StatusAvatar, TipoZona } from './types'

const TAMANHO_TILE_PX = 32

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

function AvatarNoMapa({ usuario, ehEu }: { usuario: EstadoPresencaUsuario; ehEu: boolean }) {
  const { direcao, andando } = useAnimacaoPersonagem(usuario.x)

  return (
    <div
      className="escritorio-avatar"
      data-testid={`avatar-${usuario.usuarioId}`}
      title={`${usuario.nome} - ${ROTULO_STATUS[usuario.status]}`}
      style={{
        left: usuario.x * TAMANHO_TILE_PX,
        top: usuario.y * TAMANHO_TILE_PX,
        width: TAMANHO_TILE_PX,
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

  useEffect(() => {
    const mapa = mapaQuery.data
    if (!mapa || meuUsuarioId === null) {
      return undefined
    }

    function aoPressionarTecla(evento: KeyboardEvent) {
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
  }, [mapaQuery.data, meuUsuarioId, usuarios, mover])

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
      <SugestaoRegistrarEntrada />

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
        <span className="escritorio-dock-dica">⬅️⬆️➡️⬇️ pra andar</span>
      </div>

      <div className="escritorio-layout">
        <div className="escritorio-coluna-mapa">
          <div className="escritorio-mapa-moldura">
            <div
              className="escritorio-mapa"
              data-testid="mapa"
              style={{
                width: mapa.larguraTiles * TAMANHO_TILE_PX,
                height: mapa.alturaTiles * TAMANHO_TILE_PX,
              }}
            >
              {mapa.zonas.map((zona) => (
                <div
                  key={zona.id}
                  className="escritorio-zona"
                  title={zona.nome}
                  data-testid={`zona-${zona.id}`}
                  style={{
                    left: zona.x * TAMANHO_TILE_PX,
                    top: zona.y * TAMANHO_TILE_PX,
                    width: zona.largura * TAMANHO_TILE_PX,
                    height: zona.altura * TAMANHO_TILE_PX,
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
                <AvatarNoMapa key={usuario.usuarioId} usuario={usuario} ehEu={usuario.usuarioId === meuUsuarioId} />
              ))}
            </div>
          </div>
        </div>

        <div className="escritorio-coluna-lista">
          <ListaPresenca zonas={mapa.zonas} usuarios={Object.values(usuarios)} meuUsuarioId={meuUsuarioId} />
        </div>
      </div>
    </section>
  )
}
