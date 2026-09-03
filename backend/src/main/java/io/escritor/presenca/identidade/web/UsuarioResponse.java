package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Personagem;
import io.escritor.presenca.identidade.domain.Usuario;

public record UsuarioResponse(
        Long id,
        String nome,
        String email,
        Papel papel,
        Integer cargaDiariaMinutos,
        boolean ativo,
        Personagem personagem) {

    public static UsuarioResponse de(Usuario usuario) {
        return new UsuarioResponse(
                usuario.getId(),
                usuario.getNome(),
                usuario.getEmail(),
                usuario.getPapel(),
                usuario.getCargaDiariaMinutos(),
                usuario.isAtivo(),
                usuario.getPersonagem());
    }
}
