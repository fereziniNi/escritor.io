package io.escritor.presenca.kanban.domain;

public class QuadroSemVinculoException extends RuntimeException {

    public QuadroSemVinculoException() {
        super("Um quadro precisa estar vinculado a um projeto e/ou a uma equipe");
    }
}
