package io.escritor.presenca.kanban.domain;

public class LimiteWipInvalidoException extends RuntimeException {

    public LimiteWipInvalidoException() {
        super("O limite de WIP, quando informado, precisa ser maior que zero");
    }
}
