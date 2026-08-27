package io.escritor.presenca.kanban.domain;

public class NomeColunaObrigatorioException extends RuntimeException {

    public NomeColunaObrigatorioException() {
        super("O nome da coluna é obrigatório");
    }
}
