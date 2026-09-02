package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.MembroProjeto;

public record MembroProjetoResponse(Long usuarioId, String usuarioNome) {

    public static MembroProjetoResponse de(MembroProjeto membro) {
        return new MembroProjetoResponse(membro.getUsuario().getId(), membro.getUsuario().getNome());
    }
}
