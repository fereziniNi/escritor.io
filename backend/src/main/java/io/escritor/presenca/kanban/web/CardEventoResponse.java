package io.escritor.presenca.kanban.web;

import io.escritor.presenca.kanban.domain.CardEvento;
import java.time.Instant;

public record CardEventoResponse(Long id, Long cardId, Long autorId, String tipo, String de, String para, Instant criadoEm) {

    public static CardEventoResponse de(CardEvento evento) {
        return new CardEventoResponse(
                evento.getId(),
                evento.getCard().getId(),
                evento.getAutor().getId(),
                evento.getTipo().name(),
                evento.getDe(),
                evento.getPara(),
                evento.getCriadoEm());
    }
}
