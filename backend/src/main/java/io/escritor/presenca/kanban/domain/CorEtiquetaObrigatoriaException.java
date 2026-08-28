package io.escritor.presenca.kanban.domain;

public class CorEtiquetaObrigatoriaException extends RuntimeException {

    public CorEtiquetaObrigatoriaException() {
        super("A cor da etiqueta é obrigatória");
    }
}
