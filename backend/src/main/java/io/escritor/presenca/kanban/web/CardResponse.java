package io.escritor.presenca.kanban.web;

import io.escritor.presenca.kanban.domain.Card;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

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
        boolean arquivado,
        List<EtiquetaResponse> etiquetas) {

    /**
     * Usado por criar/mover (S3.6/S3.8), onde o card recém-criado/movido nunca tem etiquetas
     * novas pra mostrar na hora - o frontend já invalida e busca o projeto de novo depois dessas
     * mutações (S3.7/S3.9), o que traz a lista completa via {@link #de(Card, List)}.
     */
    public static CardResponse de(Card card) {
        return de(card, List.of());
    }

    public static CardResponse de(Card card, List<EtiquetaResponse> etiquetas) {
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
                card.isArquivado(),
                etiquetas);
    }
}
