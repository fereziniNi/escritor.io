package io.escritor.presenca.kanban.web;

import io.escritor.presenca.kanban.domain.Etiqueta;

public record EtiquetaResponse(Long id, Long projetoId, String nome, String cor) {

    public static EtiquetaResponse de(Etiqueta etiqueta) {
        return new EtiquetaResponse(etiqueta.getId(), etiqueta.getProjeto().getId(), etiqueta.getNome(), etiqueta.getCor());
    }
}
