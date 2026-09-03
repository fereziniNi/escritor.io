package io.escritor.presenca.escritorio.ws;

import io.escritor.presenca.escritorio.domain.StatusAvatar;
import io.escritor.presenca.identidade.domain.AparenciaAvatar;

/**
 * Estado vivo de um usuário no mapa - posição, status e aparência. Fica só em memória (PRD §3.5),
 * nunca persistido diretamente aqui (a aparência em si É persistida, em {@code Usuario} - este
 * record só reflete o valor atual pra broadcast); cada atualização (movimento, status, aparência)
 * troca a instância inteira no mapa concorrente de {@link PresencaWebSocketHandler}, sem mutação de
 * campo. `aparencia` é carregada uma vez na conexão (ver {@link PresencaHandshakeInterceptor}) e
 * atualizada ao vivo por {@link PresencaWebSocketHandler#atualizarAparencia} quando a pessoa troca
 * de aparência enquanto já está no mapa - pedido do usuário: "a opção para todos detalhar da
 * melhor maneira possível o avatar".
 */
public record EstadoPresencaUsuario(Long usuarioId, String nome, int x, int y, StatusAvatar status, AparenciaAvatar aparencia) {
}
