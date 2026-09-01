package io.escritor.presenca.kanban.web;

import io.escritor.presenca.kanban.domain.Quadro;

public record QuadroResponse(Long id, String nome, Long projetoId, boolean arquivado) {

    public static QuadroResponse de(Quadro quadro) {
        Long projetoId = quadro.getProjeto() == null ? null : quadro.getProjeto().getId();
        return new QuadroResponse(quadro.getId(), quadro.getNome(), projetoId, quadro.isArquivado());
    }
}
