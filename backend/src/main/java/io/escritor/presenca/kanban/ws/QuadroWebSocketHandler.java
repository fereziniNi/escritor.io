package io.escritor.presenca.kanban.ws;

import tools.jackson.databind.ObjectMapper;
import io.escritor.presenca.kanban.web.CardResponse;
import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * PRD §5: "Spring WebSocket nativo com um handler por domínio (/ws/presenca, /ws/quadro/{id}).
 * STOMP só se quiser roteamento por tópico pronto - com 10 usuários, não é necessário." Handler
 * puro, sem broker: cada sessão fica registrada sob o {@code quadroId} resolvido no handshake
 * (ver {@link QuadroHandshakeInterceptor}) e {@link #broadcastCardMovido} manda a mesma mensagem
 * pra todas as sessões daquele quadro, incluindo a de quem disparou o `PATCH /cards/{id}/mover` -
 * o card movido não é reaplicado localmente no cliente que arrastou, então redundância aqui é
 * inofensiva (a UI já reflete o resultado otimista/revalidado da própria mutação).
 */
@Component
public class QuadroWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(QuadroWebSocketHandler.class);

    private final Map<Long, Set<WebSocketSession>> sessoesPorQuadro = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;

    public QuadroWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Long quadroId = quadroId(session);
        sessoesPorQuadro.computeIfAbsent(quadroId, id -> ConcurrentHashMap.newKeySet()).add(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Set<WebSocketSession> sessoes = sessoesPorQuadro.get(quadroId(session));
        if (sessoes != null) {
            sessoes.remove(session);
        }
    }

    public void broadcastCardMovido(Long quadroId, CardResponse card) {
        Set<WebSocketSession> sessoes = sessoesPorQuadro.get(quadroId);
        if (sessoes == null || sessoes.isEmpty()) {
            return;
        }

        String payload = objectMapper.writeValueAsString(new QuadroEventoWs("CARD_MOVIDO", card));
        TextMessage mensagem = new TextMessage(payload);
        for (WebSocketSession sessao : sessoes) {
            enviar(sessao, mensagem);
        }
    }

    private void enviar(WebSocketSession sessao, TextMessage mensagem) {
        if (!sessao.isOpen()) {
            return;
        }
        try {
            sessao.sendMessage(mensagem);
        } catch (IOException e) {
            // Sessão morta/instável: não derruba o broadcast pras outras. afterConnectionClosed
            // cuida da limpeza quando o container detectar o fechamento de verdade.
            log.warn("Falha ao enviar evento de websocket pra sessão {}", sessao.getId(), e);
        }
    }

    private Long quadroId(WebSocketSession session) {
        return (Long) session.getAttributes().get(QuadroHandshakeInterceptor.ATRIBUTO_QUADRO_ID);
    }

    private record QuadroEventoWs(String tipo, CardResponse card) {
    }
}
