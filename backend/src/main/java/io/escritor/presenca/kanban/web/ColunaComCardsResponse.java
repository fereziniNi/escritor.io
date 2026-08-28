package io.escritor.presenca.kanban.web;

import java.util.List;

public record ColunaComCardsResponse(Long id, String nome, int ordem, Integer limiteWip, List<CardResponse> cards) {
}
