package io.escritor.presenca.kanban.web;

import io.escritor.presenca.kanban.domain.MembroQuadro;

public record MembroQuadroResponse(Long usuarioId, String usuarioNome) {

    public static MembroQuadroResponse de(MembroQuadro membro) {
        return new MembroQuadroResponse(membro.getUsuario().getId(), membro.getUsuario().getNome());
    }
}
