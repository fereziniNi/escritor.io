package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.service.AutenticacaoService;
import io.escritor.presenca.identidade.service.CodigoInvalidoException;
import io.escritor.presenca.identidade.service.TokenInvalidoException;
import io.escritor.presenca.identidade.service.TokensAutenticacao;
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

@RestController
@RequestMapping("/auth")
public class AuthController {

    private static final String COOKIE_REFRESH_TOKEN = "refresh_token";
    private static final Duration VALIDADE_COOKIE_REFRESH = Duration.ofDays(30);

    private final AutenticacaoService autenticacaoService;

    public AuthController(AutenticacaoService autenticacaoService) {
        this.autenticacaoService = autenticacaoService;
    }

    @PostMapping("/codigo")
    @ResponseStatus(HttpStatus.ACCEPTED)
    public void solicitarCodigo(@Valid @RequestBody SolicitarCodigoRequest request) {
        autenticacaoService.solicitarCodigo(request.email());
    }

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody VerificarCodigoRequest request) {
        TokensAutenticacao tokens = autenticacaoService.verificarCodigo(request.email(), request.codigo());
        return respostaComTokens(tokens);
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

    @ExceptionHandler(TokenInvalidoException.class)
    ResponseEntity<Void> tratarTokenInvalido() {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                .header(HttpHeaders.SET_COOKIE, cookieRefresh("", Duration.ZERO))
                .build();
    }
}
