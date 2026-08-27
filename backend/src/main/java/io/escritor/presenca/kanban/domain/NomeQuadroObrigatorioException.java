package io.escritor.presenca.kanban.domain;

public class NomeQuadroObrigatorioException extends RuntimeException {

    public NomeQuadroObrigatorioException() {
        super("O nome do quadro é obrigatório");
    }
}
