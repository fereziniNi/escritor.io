package io.escritor.presenca.kanban.ws;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final ProjetoWebSocketHandler projetoWebSocketHandler;
    private final ProjetoHandshakeInterceptor projetoHandshakeInterceptor;

    public WebSocketConfig(ProjetoWebSocketHandler projetoWebSocketHandler, ProjetoHandshakeInterceptor projetoHandshakeInterceptor) {
        this.projetoWebSocketHandler = projetoWebSocketHandler;
        this.projetoHandshakeInterceptor = projetoHandshakeInterceptor;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(projetoWebSocketHandler, "/ws/projeto/*")
                .addInterceptors(projetoHandshakeInterceptor)
                .setAllowedOriginPatterns("*");
    }
}
