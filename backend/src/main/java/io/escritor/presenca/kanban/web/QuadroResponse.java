package io.escritor.presenca.kanban.web;

import io.escritor.presenca.kanban.domain.Quadro;

public record QuadroResponse(Long id, String nome, Long projetoId, Long equipeId, boolean arquivado) {

    public static QuadroResponse de(Quadro quadro) {
        Long projetoId = quadro.getProjeto() == null ? null : quadro.getProjeto().getId();
        Long equipeId = quadro.getEquipe() == null ? null : quadro.getEquipe().getId();
        return new QuadroResponse(quadro.getId(), quadro.getNome(), projetoId, equipeId, quadro.isArquivado());
    }
}
