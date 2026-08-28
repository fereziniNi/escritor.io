import type { EventoCard } from './types'

/**
 * Função pura de propósito (mesmo espírito de resolverMovimento/moverCardOtimista, S3.9/S3.10):
 * o rótulo por tipo é lógica testável isoladamente, sem precisar montar o componente inteiro.
 * `MUDANCA_RESPONSAVEL` ainda não tem gerador no backend (S3.17), mas o rótulo já existe aqui
 * pra não deixar um tipo do vocabulário do domínio sem tradução legível quando ele existir.
 */
export function rotuloEvento(evento: EventoCard): string {
  switch (evento.tipo) {
    case 'CRIACAO':
      return `Card criado em "${evento.para}"`
    case 'MUDANCA_COLUNA':
      return `Movido de "${evento.de}" para "${evento.para}"`
    case 'MUDANCA_RESPONSAVEL':
      return evento.de === null
        ? `Responsável definido como ${evento.para}`
        : `Responsável alterado de ${evento.de} para ${evento.para}`
    default:
      return `Evento: ${evento.tipo}`
  }
}
