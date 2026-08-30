package io.escritor.presenca.escritorio.ws;

import io.escritor.presenca.escritorio.domain.StatusAvatar;
import io.escritor.presenca.escritorio.service.ValidadorPosicaoMapa;
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
 * ele); desconectar remove o usuário do estado. Mensagem recebida do cliente é só
 * {@code {"x":.,"y":.}} - sem envelope com "tipo" pro lado de entrada, porque movimento é o único
 * tipo de mensagem que o cliente manda até aqui (S6.4); se um segundo tipo aparecer (S6.6, status
 * manual) é quando um discriminador de entrada passa a valer a pena, não antes.
 */
@Component
public class PresencaWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(PresencaWebSocketHandler.class);

    private final Map<Long, WebSocketSession> sessoesPorUsuario = new ConcurrentHashMap<>();
    private final Map<Long, EstadoPresencaUsuario> estadoPorUsuario = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper;
    private final ValidadorPosicaoMapa validadorPosicaoMapa;

    public PresencaWebSocketHandler(ObjectMapper objectMapper, ValidadorPosicaoMapa validadorPosicaoMapa) {
        this.objectMapper = objectMapper;
        this.validadorPosicaoMapa = validadorPosicaoMapa;
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

    /**
     * Payload malformado ou posição fora dos limites do mapa é silenciosamente ignorado - o
     * cliente nunca é fonte de verdade sobre posição (PRD), e uma sessão instável/maliciosa
     * mandando lixo não derruba a conexão nem afeta os demais.
     */
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        ComandoPosicaoWs comando;
        try {
            comando = objectMapper.readValue(message.getPayload(), ComandoPosicaoWs.class);
        } catch (Exception e) {
            return;
        }

        if (!validadorPosicaoMapa.dentroDosLimites(comando.x(), comando.y())) {
            return;
        }

        Long usuarioId = usuarioId(session);
        EstadoPresencaUsuario atual = estadoPorUsuario.get(usuarioId);
        if (atual == null) {
            return;
        }

        EstadoPresencaUsuario atualizado = new EstadoPresencaUsuario(atual.usuarioId(), atual.nome(), comando.x(), comando.y(), atual.status());
        estadoPorUsuario.put(usuarioId, atualizado);
        broadcast(new PresencaEventoWs("POSICAO", List.of(atualizado)));
    }

    private void enviar(WebSocketSession sessao, PresencaEventoWs evento) {
        enviarMensagem(sessao, new TextMessage(objectMapper.writeValueAsString(evento)));
    }

    private void broadcast(PresencaEventoWs evento) {
        TextMessage mensagem = new TextMessage(objectMapper.writeValueAsString(evento));
        for (WebSocketSession sessao : sessoesPorUsuario.values()) {
            enviarMensagem(sessao, mensagem);
        }
    }

    private void enviarMensagem(WebSocketSession sessao, TextMessage mensagem) {
        if (!sessao.isOpen()) {
            return;
        }
        try {
            sessao.sendMessage(mensagem);
        } catch (IOException e) {
            log.warn("Falha ao enviar evento de presença pra sessão {}", sessao.getId(), e);
        }
    }

    private Long usuarioId(WebSocketSession session) {
        return (Long) session.getAttributes().get(PresencaHandshakeInterceptor.ATRIBUTO_USUARIO_ID);
    }

    private record PresencaEventoWs(String tipo, List<EstadoPresencaUsuario> usuarios) {
    }

    private record ComandoPosicaoWs(int x, int y) {
    }
}
