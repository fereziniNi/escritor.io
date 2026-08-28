package io.escritor.presenca.kanban.web;

import io.escritor.presenca.kanban.domain.CardComentario;
import java.time.Instant;

public record CardComentarioResponse(Long id, Long cardId, Long autorId, String texto, Instant criadoEm) {

    public static CardComentarioResponse de(CardComentario comentario) {
        return new CardComentarioResponse(
                comentario.getId(),
                comentario.getCard().getId(),
                comentario.getAutor().getId(),
                comentario.getTexto(),
                comentario.getCriadoEm());
    }
}
