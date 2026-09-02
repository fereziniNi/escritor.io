package io.escritor.presenca.kanban.domain;

public class EtiquetaDeOutroProjetoException extends RuntimeException {

    public EtiquetaDeOutroProjetoException(Long etiquetaId, Long cardId) {
        super("A etiqueta " + etiquetaId + " não pertence ao projeto do card " + cardId);
    }
}
