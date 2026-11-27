package io.escritor.presenca.kanban.domain;

public class ProjetoSemColunasException extends RuntimeException {

    public ProjetoSemColunasException(Long projetoId) {
        super("O projeto " + projetoId + " não tem colunas");
    }
}
