package io.escritor.presenca.kanban.domain;

public class NomeEtiquetaObrigatorioException extends RuntimeException {

    public NomeEtiquetaObrigatorioException() {
        super("O nome da etiqueta é obrigatório");
    }
}
