package io.escritor.presenca.googlecalendar.domain;

/** {@code state} do callback não corresponde a nenhum nonce vivo (inexistente, expirado ou já
 * usado) - ver {@code GoogleOAuthService#tratarCallback}. */
public class EstadoOAuthInvalidoException extends RuntimeException {

    public EstadoOAuthInvalidoException() {
        super("Estado do OAuth da Google inválido ou expirado");
    }
}
