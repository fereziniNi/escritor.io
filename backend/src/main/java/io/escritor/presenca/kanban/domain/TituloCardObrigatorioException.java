package io.escritor.presenca.kanban.domain;

public class TituloCardObrigatorioException extends RuntimeException {

    public TituloCardObrigatorioException() {
        super("O título do card é obrigatório");
    }
}
