import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { buscarMapaAtivo } from './api'
import { usePresencaWebSocket } from './usePresencaWebSocket'
import type { StatusAvatar, TipoZona } from './types'

const TAMANHO_TILE_PX = 32

const OPCOES_STATUS: StatusAvatar[] = ['DISPONIVEL', 'FOCO', 'REUNIAO', 'ALMOCO', 'AUSENTE']

const ROTULO_STATUS: Record<StatusAvatar, string> = {
  DISPONIVEL: 'Disponível',
  FOCO: 'Foco',
  REUNIAO: 'Reunião',
  ALMOCO: 'Almoço',
  AUSENTE: 'Ausente',
}

const TECLA_PARA_DELTA: Record<string, readonly [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
}

const COR_POR_TIPO_ZONA: Record<TipoZona, string> = {
  FOCO: '#cdeccd',
  REUNIAO: '#cddcec',
  CAFE: '#ecdccd',
  ATENDIMENTO: '#eccdcd',
  LIVRE: '#e8e8e8',
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
 * até a próxima correção.
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
    <section>
      <h2>{mapa.nome}</h2>
      <label>
        Status
        <select
          value={meuStatus ?? 'DISPONIVEL'}
          onChange={(evento) => definirStatus(evento.target.value as StatusAvatar)}
        >
          {OPCOES_STATUS.map((status) => (
            <option key={status} value={status}>
              {ROTULO_STATUS[status]}
            </option>
          ))}
        </select>
      </label>
      <div
        data-testid="mapa"
        style={{
          position: 'relative',
          width: mapa.larguraTiles * TAMANHO_TILE_PX,
          height: mapa.alturaTiles * TAMANHO_TILE_PX,
          border: '1px solid #999',
        }}
      >
        {mapa.zonas.map((zona) => (
          <div
            key={zona.id}
            title={zona.nome}
            data-testid={`zona-${zona.id}`}
            style={{
              position: 'absolute',
              left: zona.x * TAMANHO_TILE_PX,
              top: zona.y * TAMANHO_TILE_PX,
              width: zona.largura * TAMANHO_TILE_PX,
              height: zona.altura * TAMANHO_TILE_PX,
              background: COR_POR_TIPO_ZONA[zona.tipo],
            }}
          >
            {zona.nome}
          </div>
        ))}

        {Object.values(usuarios).map((usuario) => (
          <div
            key={usuario.usuarioId}
            data-testid={`avatar-${usuario.usuarioId}`}
            title={`${usuario.nome} - ${ROTULO_STATUS[usuario.status]}`}
            style={{
              position: 'absolute',
              left: usuario.x * TAMANHO_TILE_PX,
              top: usuario.y * TAMANHO_TILE_PX,
              width: TAMANHO_TILE_PX,
              height: TAMANHO_TILE_PX,
              borderRadius: '50%',
              background: usuario.usuarioId === meuUsuarioId ? '#3366ff' : '#666',
              color: '#fff',
              fontSize: '10px',
              textAlign: 'center',
            }}
          >
            {usuario.nome}
          </div>
        ))}
      </div>
    </section>
  )
}
