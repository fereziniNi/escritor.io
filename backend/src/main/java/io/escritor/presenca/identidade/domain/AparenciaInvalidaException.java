package io.escritor.presenca.identidade.domain;

public class AparenciaInvalidaException extends RuntimeException {

    public AparenciaInvalidaException(String mensagem) {
        super(mensagem);
    }
}
