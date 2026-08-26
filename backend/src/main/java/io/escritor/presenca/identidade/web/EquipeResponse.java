package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.Equipe;

public record EquipeResponse(Long id, String nome, String descricao, boolean ativa) {

    public static EquipeResponse de(Equipe equipe) {
        return new EquipeResponse(equipe.getId(), equipe.getNome(), equipe.getDescricao(), equipe.isAtiva());
    }
}
