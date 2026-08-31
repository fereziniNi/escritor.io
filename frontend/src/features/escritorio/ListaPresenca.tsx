import { COR_STATUS, ICONE_STATUS, ICONE_ZONA } from './icones'
import { localizarZona } from './localizarZona'
import { ROTULO_STATUS } from './statusAvatar'
import type { EstadoPresencaUsuario, Zona } from './types'

function ItemUsuario({ usuario, souEu, proximo }: { usuario: EstadoPresencaUsuario; souEu: boolean; proximo: boolean }) {
  return (
    <li className={proximo ? 'escritorio-lista-item--proximo' : undefined}>
      <span className="escritorio-lista-avatar-swatch" style={{ background: COR_STATUS[usuario.status] }} />
      {ICONE_STATUS[usuario.status]} {usuario.nome}
      {souEu ? ' (você)' : ''} - {ROTULO_STATUS[usuario.status]}
      {proximo && <span className="escritorio-lista-item-proximidade" title="Perto de alguém agora"> 📍</span>}
    </li>
  )
}

/**
 * Puramente presentacional - recebe `usuarios` já resolvido de `usePresencaWebSocket` (S6.5/S6.6),
 * então atualiza em tempo real de graça: qualquer `POSICAO`/`STATUS` que muda o estado do hook
 * já reflete aqui no próximo render, sem lógica de "tempo real" própria nesta lista.
 */
export function ListaPresenca({
  zonas,
  usuarios,
  meuUsuarioId,
  usuariosProximos,
}: {
  zonas: Zona[]
  usuarios: EstadoPresencaUsuario[]
  meuUsuarioId: number | null
  /** Fase 3 - ids de quem está dentro do raio de proximidade de alguém (`proximidade.ts`),
   * opcional pra não obrigar todo chamador a calcular isso. */
  usuariosProximos?: Set<number>
}) {
  const usuariosPorZonaId = new Map<number, EstadoPresencaUsuario[]>()
  const semZona: EstadoPresencaUsuario[] = []

  for (const usuario of usuarios) {
    const zona = localizarZona(zonas, usuario.x, usuario.y)
    if (zona) {
      const lista = usuariosPorZonaId.get(zona.id) ?? []
      lista.push(usuario)
      usuariosPorZonaId.set(zona.id, lista)
    } else {
      semZona.push(usuario)
    }
  }

  return (
    <section className="escritorio-lista-presenca" aria-label="Lista de presença">
      <h3>🧭 Quem está no escritório</h3>
      {usuarios.length === 0 && <p>Ninguém conectado.</p>}
      {zonas.map((zona) => (
        <div key={zona.id} className="escritorio-lista-grupo" data-testid={`presenca-zona-${zona.id}`}>
          <h4>
            {ICONE_ZONA[zona.tipo]} {zona.nome}
          </h4>
          {(usuariosPorZonaId.get(zona.id) ?? []).length === 0 ? (
            <p>Ninguém por aqui agora.</p>
          ) : (
            <ul>
              {(usuariosPorZonaId.get(zona.id) ?? []).map((usuario) => (
                <ItemUsuario key={usuario.usuarioId} usuario={usuario} souEu={usuario.usuarioId === meuUsuarioId} proximo={usuariosProximos?.has(usuario.usuarioId) ?? false} />
              ))}
            </ul>
          )}
        </div>
      ))}
      <div className="escritorio-lista-grupo" data-testid="presenca-zona-aberto">
        <h4>🌤️ Espaço aberto</h4>
        {semZona.length === 0 ? (
          <p>Ninguém por aqui agora.</p>
        ) : (
          <ul>
            {semZona.map((usuario) => (
              <ItemUsuario key={usuario.usuarioId} usuario={usuario} souEu={usuario.usuarioId === meuUsuarioId} proximo={usuariosProximos?.has(usuario.usuarioId) ?? false} />
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
