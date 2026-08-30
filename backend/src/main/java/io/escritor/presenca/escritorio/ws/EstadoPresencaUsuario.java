package io.escritor.presenca.escritorio.ws;

import io.escritor.presenca.escritorio.domain.StatusAvatar;

/**
 * Estado vivo de um usuário no mapa - posição e status. Fica só em memória (PRD §3.5), nunca
 * persistido; cada atualização (movimento, status) troca a instância inteira no mapa concorrente
 * de {@link PresencaWebSocketHandler}, sem mutação de campo.
 */
public record EstadoPresencaUsuario(Long usuarioId, String nome, int x, int y, StatusAvatar status) {
}
