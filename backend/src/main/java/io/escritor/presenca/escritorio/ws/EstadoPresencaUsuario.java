package io.escritor.presenca.escritorio.ws;

import io.escritor.presenca.escritorio.domain.StatusAvatar;
import io.escritor.presenca.identidade.domain.Personagem;

/**
 * Estado vivo de um usuário no mapa - posição, status e personagem. Fica só em memória (PRD
 * §3.5), nunca persistido diretamente aqui (o personagem em si É persistido, em {@code Usuario} -
 * este record só reflete o valor atual pra broadcast); cada atualização (movimento, status,
 * personagem) troca a instância inteira no mapa concorrente de {@link PresencaWebSocketHandler},
 * sem mutação de campo. `personagem` é carregado uma vez na conexão (ver {@link
 * PresencaHandshakeInterceptor}) e atualizado ao vivo por {@link
 * PresencaWebSocketHandler#atualizarPersonagem} quando a pessoa troca de personagem enquanto já
 * está no mapa - pedido do usuário: "a opção para todos detalhar da melhor maneira possível o
 * avatar".
 */
public record EstadoPresencaUsuario(Long usuarioId, String nome, int x, int y, StatusAvatar status, Personagem personagem) {
}
