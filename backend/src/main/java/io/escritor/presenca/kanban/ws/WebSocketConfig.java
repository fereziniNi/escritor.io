package io.escritor.presenca.kanban.ws;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final QuadroWebSocketHandler quadroWebSocketHandler;
    private final QuadroHandshakeInterceptor quadroHandshakeInterceptor;

    public WebSocketConfig(QuadroWebSocketHandler quadroWebSocketHandler, QuadroHandshakeInterceptor quadroHandshakeInterceptor) {
        this.quadroWebSocketHandler = quadroWebSocketHandler;
        this.quadroHandshakeInterceptor = quadroHandshakeInterceptor;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(quadroWebSocketHandler, "/ws/quadro/*")
                .addInterceptors(quadroHandshakeInterceptor)
                .setAllowedOriginPatterns("*");
    }
}
