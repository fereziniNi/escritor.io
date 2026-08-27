package io.escritor.presenca.kanban.domain;

public class EstimativaInvalidaException extends RuntimeException {

    public EstimativaInvalidaException() {
        super("A estimativa, quando informada, precisa ser maior que zero");
    }
}
