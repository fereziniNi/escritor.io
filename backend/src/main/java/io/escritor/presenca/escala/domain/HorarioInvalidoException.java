package io.escritor.presenca.escala.domain;

public class HorarioInvalidoException extends RuntimeException {

    public HorarioInvalidoException(String mensagem) {
        super(mensagem);
    }
}
