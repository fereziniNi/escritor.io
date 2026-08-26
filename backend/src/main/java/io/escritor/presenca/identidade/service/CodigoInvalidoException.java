package io.escritor.presenca.identidade.service;

public class CodigoInvalidoException extends RuntimeException {

    public CodigoInvalidoException() {
        super("Código inválido, expirado ou já utilizado");
    }
}
