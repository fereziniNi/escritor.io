import { localizarZona } from './localizarZona'
import { ROTULO_STATUS } from './statusAvatar'
import type { EstadoPresencaUsuario, Zona } from './types'

/**
 * Puramente presentacional - recebe `usuarios` já resolvido de `usePresencaWebSocket` (S6.5/S6.6),
 * então atualiza em tempo real de graça: qualquer `POSICAO`/`STATUS` que muda o estado do hook
 * já reflete aqui no próximo render, sem lógica de "tempo real" própria nesta lista.
 */
export function ListaPresenca({
  zonas,
  usuarios,
  meuUsuarioId,
}: {
  zonas: Zona[]
  usuarios: EstadoPresencaUsuario[]
  meuUsuarioId: number | null
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
    <section aria-label="Lista de presença">
      <h3>Quem está no escritório</h3>
      {usuarios.length === 0 && <p>Ninguém conectado.</p>}
      {zonas.map((zona) => (
        <div key={zona.id} data-testid={`presenca-zona-${zona.id}`}>
          <h4>{zona.nome}</h4>
          <ul>
            {(usuariosPorZonaId.get(zona.id) ?? []).map((usuario) => (
              <li key={usuario.usuarioId}>
                {usuario.nome}
                {usuario.usuarioId === meuUsuarioId ? ' (você)' : ''} - {ROTULO_STATUS[usuario.status]}
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div data-testid="presenca-zona-aberto">
        <h4>Espaço aberto</h4>
        <ul>
          {semZona.map((usuario) => (
            <li key={usuario.usuarioId}>
              {usuario.nome}
              {usuario.usuarioId === meuUsuarioId ? ' (você)' : ''} - {ROTULO_STATUS[usuario.status]}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
