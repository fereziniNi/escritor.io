package io.escritor.presenca.kanban.domain;

public class EtiquetaDeOutroQuadroException extends RuntimeException {

    public EtiquetaDeOutroQuadroException(Long etiquetaId, Long cardId) {
        super("A etiqueta " + etiquetaId + " não pertence ao quadro do card " + cardId);
    }
}
