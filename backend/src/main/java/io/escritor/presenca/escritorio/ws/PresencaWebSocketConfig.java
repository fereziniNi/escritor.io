package io.escritor.presenca.escritorio.ws;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

/**
 * Registro próprio deste bounded context - Spring aceita múltiplos beans
 * {@link WebSocketConfigurer}, cada um contribuindo suas rotas pro mesmo registry, então não
 * precisa (nem deve) tocar em {@code kanban.ws.WebSocketConfig} pra adicionar {@code
 * /ws/presenca}. Nome da classe não pode ser {@code WebSocketConfig} (igual ao de kanban) -
 * bean name default do Spring é derivado do nome curto da classe, e duas classes com o mesmo
 * nome simples em pacotes diferentes colidiriam nesse nome, mesmo sendo tipos diferentes.
 */
@Configuration
@EnableWebSocket
public class PresencaWebSocketConfig implements WebSocketConfigurer {

    private final PresencaWebSocketHandler presencaWebSocketHandler;
    private final PresencaHandshakeInterceptor presencaHandshakeInterceptor;

    public PresencaWebSocketConfig(
            PresencaWebSocketHandler presencaWebSocketHandler, PresencaHandshakeInterceptor presencaHandshakeInterceptor) {
        this.presencaWebSocketHandler = presencaWebSocketHandler;
        this.presencaHandshakeInterceptor = presencaHandshakeInterceptor;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(presencaWebSocketHandler, "/ws/presenca")
                .addInterceptors(presencaHandshakeInterceptor)
                .setAllowedOriginPatterns("*");
    }
}
