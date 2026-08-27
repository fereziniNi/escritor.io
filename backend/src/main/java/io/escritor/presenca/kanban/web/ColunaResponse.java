package io.escritor.presenca.kanban.web;

import io.escritor.presenca.kanban.domain.Coluna;

public record ColunaResponse(Long id, Long quadroId, String nome, int ordem, Integer limiteWip) {

    public static ColunaResponse de(Coluna coluna) {
        return new ColunaResponse(
                coluna.getId(), coluna.getQuadro().getId(), coluna.getNome(), coluna.getOrdem(), coluna.getLimiteWip());
    }
}
