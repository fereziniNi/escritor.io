package io.escritor.presenca.ponto.domain;

public class JornadaDeOutroUsuarioException extends RuntimeException {

    public JornadaDeOutroUsuarioException() {
        super("Esta jornada pertence a outro usuário");
    }
}
