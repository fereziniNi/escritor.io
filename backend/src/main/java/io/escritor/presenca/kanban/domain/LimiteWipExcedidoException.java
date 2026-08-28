package io.escritor.presenca.kanban.domain;

public class LimiteWipExcedidoException extends RuntimeException {

    public LimiteWipExcedidoException(Long colunaId, int limiteWip) {
        super("A coluna " + colunaId + " já está no limite de WIP (" + limiteWip + ")");
    }
}
