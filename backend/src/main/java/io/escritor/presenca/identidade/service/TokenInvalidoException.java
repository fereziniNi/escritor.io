package io.escritor.presenca.identidade.service;

public class TokenInvalidoException extends RuntimeException {

    public TokenInvalidoException() {
        super("Refresh token inválido, expirado ou já utilizado");
    }
}
