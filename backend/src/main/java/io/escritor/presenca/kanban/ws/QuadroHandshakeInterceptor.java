package io.escritor.presenca.kanban.ws;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import io.escritor.presenca.kanban.service.QuadroService;
import io.escritor.presenca.seguranca.JwtService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

/**
 * Autentica e autoriza o handshake de {@code /ws/quadro/{id}} sozinho, sem passar pelo
 * {@code JwtAuthenticationFilter} do Spring Security (por isso o path é liberado em
 * {@code SecurityConfig}): o WebSocket nativo do browser não permite setar o header
 * `Authorization`, então o access token viaja como query param (`?token=`) - único lugar do app
 * onde isso acontece, e só pro handshake em si (mensagens depois disso não carregam token de
 * novo). Rejeita com 401 (sem token/token inválido) ou 403 (token válido, mas
 * {@link QuadroService#usuarioPodeVer} nega) antes mesmo do upgrade pra WebSocket acontecer -
 * mesma regra de visibilidade de {@code GET /quadros/{id}} (S3.2/S3.7), não uma nova.
 */
@Component
public class QuadroHandshakeInterceptor implements HandshakeInterceptor {

    static final String ATRIBUTO_QUADRO_ID = "quadroId";

    private static final Pattern PADRAO_PATH = Pattern.compile("/ws/quadro/(\\d+)$");

    private final JwtService jwtService;
    private final UsuarioRepository usuarioRepository;
    private final QuadroService quadroService;

    public QuadroHandshakeInterceptor(JwtService jwtService, UsuarioRepository usuarioRepository, QuadroService quadroService) {
        this.jwtService = jwtService;
        this.usuarioRepository = usuarioRepository;
        this.quadroService = quadroService;
    }

    @Override
    public boolean beforeHandshake(
            ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Map<String, Object> attributes) {
        Matcher matcher = PADRAO_PATH.matcher(request.getURI().getPath());
        if (!matcher.find()) {
            response.setStatusCode(HttpStatus.NOT_FOUND);
            return false;
        }
        Long quadroId = Long.valueOf(matcher.group(1));

        Optional<Usuario> usuario = autenticar(request);
        if (usuario.isEmpty()) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
        if (!quadroService.usuarioPodeVer(quadroId, usuario.get())) {
            response.setStatusCode(HttpStatus.FORBIDDEN);
            return false;
        }

        attributes.put(ATRIBUTO_QUADRO_ID, quadroId);
        return true;
    }

    @Override
    public void afterHandshake(
            ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler, Exception exception) {
        // nada a fazer - a limpeza de sessão fica no próprio handler (afterConnectionClosed)
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
