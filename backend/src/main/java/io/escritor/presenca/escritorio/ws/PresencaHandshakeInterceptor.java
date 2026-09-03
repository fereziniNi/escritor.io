package io.escritor.presenca.escritorio.ws;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.seguranca.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import java.util.Map;
import java.util.Optional;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Autentica o handshake de {@code /ws/presenca} sozinho, mesmo motivo/mecanismo de {@code
 * ProjetoHandshakeInterceptor} (kanban, S3.11): o WebSocket nativo do browser não permite setar o
 * header {@code Authorization}, então o access token viaja como query param (?token=). Diferente
 * do handshake de projeto, não há checagem de autorização por recurso aqui - qualquer usuário
 * autenticado pode entrar no mapa (PRD: "usar o mapa" é ação de qualquer papel, não só
 * gestor/admin) - só 401 (sem token/token inválido), nunca 403.
 */
@Component
public class PresencaHandshakeInterceptor implements HandshakeInterceptor {

    static final String ATRIBUTO_USUARIO_ID = "usuarioId";
    static final String ATRIBUTO_NOME = "nome";
    static final String ATRIBUTO_APARENCIA = "aparencia";

    private final JwtService jwtService;
    private final UsuarioRepository usuarioRepository;

    public PresencaHandshakeInterceptor(JwtService jwtService, UsuarioRepository usuarioRepository) {
        this.jwtService = jwtService;
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Map<String, Object> attributes) {
        Optional<Usuario> usuario = autenticar(request);
        if (usuario.isEmpty()) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        attributes.put(ATRIBUTO_USUARIO_ID, usuario.get().getId());
        attributes.put(ATRIBUTO_NOME, usuario.get().getNome());
        // aparência carregada uma única vez aqui (valor "de agora") - se a pessoa trocar de
        // aparência enquanto já está conectada, quem já está no mapa é avisado por
        // PresencaWebSocketHandler#atualizarAparencia, não por este handshake de novo.
        attributes.put(ATRIBUTO_APARENCIA, usuario.get().getAparencia());
        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Exception exception) {
        // nada a fazer - a limpeza do estado em memória fica no próprio handler (afterConnectionClosed)
    }

    private Optional<Usuario> autenticar(ServerHttpRequest request) {
        String token = UriComponentsBuilder.fromUri(request.getURI())
                .build()
                .getQueryParams()
                .getFirst("token");
        if (token == null || token.isBlank()) {
            return Optional.empty();
        }

        Optional<Jws<Claims>> jws = jwtService.validar(token);
        if (jws.isEmpty()) {
            return Optional.empty();
        }

        Long usuarioId = Long.valueOf(jws.get().getPayload().getSubject());
        return usuarioRepository.findById(usuarioId);
    }
}
