package io.escritor.presenca.kanban.domain;

public class TextoComentarioObrigatorioException extends RuntimeException {

    public TextoComentarioObrigatorioException() {
        super("O texto do comentário é obrigatório");
    }
}
