package io.escritor.presenca.escritorio.ws;

import io.escritor.presenca.escritorio.domain.StatusAvatar;
import tools.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

/**
 * PRD §5/§3.5: handler puro (sem STOMP), mesmo espírito de {@code QuadroWebSocketHandler}
 * (kanban, S3.11), mas global - não há "sala"/id de recurso aqui, só um canal único de presença
 * pra todo mundo autenticado. Estado vivo (posição, status) fica só neste mapa em memória, nunca
 * no banco (PRD). Conectar registra o usuário com posição inicial (0,0) e status
 * {@code DISPONIVEL}, e devolve pra ele mesmo um snapshot de todo mundo presente (incluindo
 * ele); desconectar remove o usuário do estado. Broadcast pros demais de entrada/saída/movimento
 * fica pras fatias seguintes (S6.4+) - esta cuida só do registro em si.
 */
@Component
public class PresencaWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(PresencaWebSocketHandler.class);

    private final Map<Long, WebSocketSession> sessoesPorUsuario = new ConcurrentHashMap<>();
    private final Map<Long, EstadoPresencaUsuario> estadoPorUsuario = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;

    public PresencaWebSocketHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        Long usuarioId = usuarioId(session);
        String nome = (String) session.getAttributes().get(PresencaHandshakeInterceptor.ATRIBUTO_NOME);

        estadoPorUsuario.put(usuarioId, new EstadoPresencaUsuario(usuarioId, nome, 0, 0, StatusAvatar.DISPONIVEL));
        sessoesPorUsuario.put(usuarioId, session);

        enviar(session, new PresencaEventoWs("SNAPSHOT", List.copyOf(estadoPorUsuario.values())));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        Long usuarioId = usuarioId(session);
        estadoPorUsuario.remove(usuarioId);
        sessoesPorUsuario.remove(usuarioId);
    }

    private void enviar(WebSocketSession sessao, PresencaEventoWs evento) {
        if (!sessao.isOpen()) {
            return;
        }
        try {
            sessao.sendMessage(new TextMessage(objectMapper.writeValueAsString(evento)));
        } catch (IOException e) {
            log.warn("Falha ao enviar evento de presença pra sessão {}", sessao.getId(), e);
        }
    }

    private Long usuarioId(WebSocketSession session) {
        return (Long) session.getAttributes().get(PresencaHandshakeInterceptor.ATRIBUTO_USUARIO_ID);
    }

    private record PresencaEventoWs(String tipo, List<EstadoPresencaUsuario> usuarios) {
    }
}
