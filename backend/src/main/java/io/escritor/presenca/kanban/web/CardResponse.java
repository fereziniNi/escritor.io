package io.escritor.presenca.kanban.web;

import io.escritor.presenca.kanban.domain.Card;
import java.time.Instant;
import java.time.LocalDate;

public record CardResponse(
        Long id,
        Long colunaId,
        String titulo,
        String descricao,
        double posicao,
        Long responsavelId,
        LocalDate prazo,
        Integer estimativaMinutos,
        Long criadoPorId,
        Instant criadoEm,
        boolean arquivado) {

    public static CardResponse de(Card card) {
        Long responsavelId = card.getResponsavel() == null ? null : card.getResponsavel().getId();
        return new CardResponse(
                card.getId(),
                card.getColuna().getId(),
                card.getTitulo(),
                card.getDescricao(),
                card.getPosicao(),
                responsavelId,
                card.getPrazo(),
                card.getEstimativaMinutos(),
                card.getCriadoPor().getId(),
                card.getCriadoEm(),
                card.isArquivado());
    }
}
