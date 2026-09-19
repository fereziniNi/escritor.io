package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.service.AutenticacaoService;
import io.escritor.presenca.identidade.service.CodigoInvalidoException;
import io.escritor.presenca.identidade.service.LimiteDeTentativasExcedidoException;
import io.escritor.presenca.identidade.service.TokenInvalidoException;
import io.escritor.presenca.identidade.service.TokensAutenticacao;
import io.escritor.presenca.seguranca.LimitadorDeTaxa;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.Duration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Auditoria de segurança (VULN-05, MEDIUM): {@code /auth/codigo}/{@code /auth/login} ganharam um
 * limite por IP via {@link LimitadorDeTaxa}, além das proteções por conta que já existiam em
 * {@code AutenticacaoService} (cooldown de 30s, 5 tentativas por código) - essas não impediam
 * varrer várias contas, nem "bombardear" o e-mail de uma vítima com pedidos de código repetidos.
 * {@code /auth/refresh} fica de fora de propósito: exige posse do cookie {@code httpOnly}, não é o
 * alvo de força bruta que os outros dois são.
 */
@RestController
@RequestMapping("/auth")
public class AuthController {

    private static final String COOKIE_REFRESH_TOKEN = "refresh_token";
    private static final Duration VALIDADE_COOKIE_REFRESH = Duration.ofDays(30);

    // Limites generosos o bastante pra nunca incomodar um usuário legítimo (pedir/errar um
    // código algumas vezes em minutos é normal) mas que cortam drasticamente o volume de um
    // abuso automatizado de um mesmo IP - não resolve um atacante distribuído entre muitos IPs
    // (fora do escopo de um limitador em memória, de processo único - ver javadoc de
    // LimitadorDeTaxa), mas hoje não existe limite NENHUM, então isso já é uma melhora real.
    private static final int LIMITE_SOLICITAR_CODIGO = 10;
    private static final int LIMITE_LOGIN = 20;
    private static final Duration JANELA_RATE_LIMIT = Duration.ofMinutes(5);

    private final AutenticacaoService autenticacaoService;
    private final LimitadorDeTaxa limitadorDeTaxa;

    public AuthController(AutenticacaoService autenticacaoService, LimitadorDeTaxa limitadorDeTaxa) {
        this.autenticacaoService = autenticacaoService;
        this.limitadorDeTaxa = limitadorDeTaxa;
    }

    @PostMapping("/codigo")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void solicitarCodigo(@Valid @RequestBody SolicitarCodigoRequest request, HttpServletRequest http) {
        exigirDentroDoLimite("codigo:" + ipDoCliente(http), LIMITE_SOLICITAR_CODIGO);
        autenticacaoService.solicitarCodigo(request.email());
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody VerificarCodigoRequest request, HttpServletRequest http) {
        exigirDentroDoLimite("login:" + ipDoCliente(http), LIMITE_LOGIN);
        TokensAutenticacao tokens = autenticacaoService.verificarCodigo(request.email(), request.codigo());
        return respostaComTokens(tokens);
    }

    private void exigirDentroDoLimite(String chave, int limite) {
        if (!limitadorDeTaxa.permitir(chave, limite, JANELA_RATE_LIMIT)) {
            throw new LimiteDeTentativasExcedidoException();
        }
    }

    /**
     * Achado implantando no Railway: atrás de proxy reverso (Nginx local, ou Nginx + rede privada
     * do Railway em produção), {@code HttpServletRequest#getRemoteAddr()} só devolve o IP real do
     * cliente se {@code server.forward-headers-strategy: native} (ver application.yml) conseguir
     * casar CADA salto intermediário contra a lista de "proxies internos confiáveis" do Tomcat -
     * que só cobre as faixas privadas de sempre (10.x, 172.16-31.x, 192.168.x). O Railway usa
     * endereçamento próprio pra rede privada entre serviços, fora dessas faixas, então esse
     * casamento falha e {@code getRemoteAddr()} devolve algo inconsistente entre requisições -
     * confirmado ao vivo (o limite por IP simplesmente não disparava through o domínio público do
     * frontend). Lendo o header direto: o Nginx (`X-Forwarded-For $proxy_add_x_forwarded_for`)
     * sempre ACRESCENTA ao header existente, nunca sobrescreve - então o primeiro endereço da
     * lista continua sendo o cliente original não importa quantos saltos internos aconteçam
     * depois, sem precisar reconhecer o endereçamento de cada proxy no meio do caminho.
     */
    private static String ipDoCliente(HttpServletRequest http) {
        String encaminhado = http.getHeader("X-Forwarded-For");
        if (encaminhado != null && !encaminhado.isBlank()) {
            return encaminhado.split(",")[0].trim();
        }
        return http.getRemoteAddr();
    }

    @PostMapping("/refresh")
    public ResponseEntity<LoginResponse> refresh(
            @CookieValue(name = COOKIE_REFRESH_TOKEN, required = false) String refreshToken) {
        if (refreshToken == null) {
            throw new TokenInvalidoException();
        }

        TokensAutenticacao tokens = autenticacaoService.renovarToken(refreshToken);
        return respostaComTokens(tokens);
    }

    private ResponseEntity<LoginResponse> respostaComTokens(TokensAutenticacao tokens) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookieRefresh(tokens.refreshToken(), VALIDADE_COOKIE_REFRESH))
                .body(new LoginResponse(tokens.accessToken()));
    }

    private String cookieRefresh(String valor, Duration validade) {
        return ResponseCookie.from(COOKIE_REFRESH_TOKEN, valor)
                .httpOnly(true)
                .secure(true)
                .sameSite("Strict")
                .path("/auth")
                .maxAge(validade)
                .build()
                .toString();
    }

    @ExceptionHandler(CodigoInvalidoException.class)
    ResponseEntity<Void> tratarCodigoInvalido() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
    }

    @ExceptionHandler(LimiteDeTentativasExcedidoException.class)
    ResponseEntity<Void> tratarLimiteExcedido() {
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).build();
    }

    @ExceptionHandler(TokenInvalidoException.class)
    ResponseEntity<Void> tratarTokenInvalido() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .header(HttpHeaders.SET_COOKIE, cookieRefresh("", Duration.ZERO))
                .build();
    }
}
