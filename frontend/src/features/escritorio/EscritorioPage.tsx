import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { buscarMapaAtivo } from './api'
import './EscritorioPage.css'
import { ICONE_STATUS, ICONE_ZONA } from './icones'
import { ListaPresenca } from './ListaPresenca'
import { OPCOES_STATUS, ROTULO_STATUS } from './statusAvatar'
import { SugestaoRegistrarEntrada } from './SugestaoRegistrarEntrada'
import { usePresencaWebSocket } from './usePresencaWebSocket'
import type { StatusAvatar, TipoZona } from './types'

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

/**
 * Renderização com `<div>`s posicionados via `position: absolute` em vez de `<canvas>`/Konva
 * (PRD §6 deixa a escolha em aberto: "react-konva ou canvas puro"): jsdom não implementa um
 * canvas 2D de verdade (`getContext` volta `null` sem uma lib de mock dedicada), e testar via
 * DOM real de qualquer jeito é consistente com o resto do projeto (RTL cobre o comportamento,
 * Playwright cobre o visual de verdade em navegador real) - sem precisar de uma dependência nova
 * só pra viabilizar teste. Em 20×15 tiles isso são no máximo algumas centenas de elementos,
 * irrelevante de performance.
 *
 * Movimento por seta atualiza a posição local de imediato via `mover` (predição, S6.4/PRD) - o
 * clamp contra `larguraTiles`/`alturaTiles` aqui é só uma cortesia visual (o servidor já valida
 * de verdade e ignora silenciosamente qualquer posição fora dos limites, ver
 * `ValidadorPosicaoMapa`); sem ele, a predição local deixaria o avatar visualmente sair do mapa
 * até a próxima correção. O visual (piso quadriculado, avatares-personagem, ícones de sala) é
 * puramente decorativo - `left`/`top`/`data-testid` continuam sendo os únicos contratos que os
 * testes e o resto do app dependem.
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

      <div className="escritorio-hud">
        <span className="escritorio-hud-rotulo">Meu status</span>
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
        <span style={{ fontSize: '0.8rem', color: 'var(--cor-texto-suave)' }}>
          Mova com as setas do teclado ⬅️⬆️➡️⬇️
        </span>
      </div>

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
              <span className="escritorio-zona-icone">{ICONE_ZONA[zona.tipo]}</span>
              <span>{zona.nome}</span>
            </div>
          ))}

          {Object.values(usuarios).map((usuario) => (
            <div
              key={usuario.usuarioId}
              className={`escritorio-avatar${usuario.usuarioId === meuUsuarioId ? ' escritorio-avatar--eu' : ''}`}
              data-testid={`avatar-${usuario.usuarioId}`}
              title={`${usuario.nome} - ${ROTULO_STATUS[usuario.status]}`}
              style={{
                left: usuario.x * TAMANHO_TILE_PX,
                top: usuario.y * TAMANHO_TILE_PX,
                width: TAMANHO_TILE_PX,
              }}
            >
              <span className="escritorio-avatar-corpo">
                {usuario.nome.charAt(0).toUpperCase()}
                <span className="escritorio-avatar-status">{ICONE_STATUS[usuario.status]}</span>
              </span>
              <span className="escritorio-avatar-nome">{usuario.nome}</span>
            </div>
          ))}
        </div>
      </div>

      <ListaPresenca zonas={mapa.zonas} usuarios={Object.values(usuarios)} meuUsuarioId={meuUsuarioId} />
    </section>
  )
}
