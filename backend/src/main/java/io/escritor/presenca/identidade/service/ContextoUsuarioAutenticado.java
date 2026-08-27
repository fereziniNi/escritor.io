package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Resolve o {@link Usuario} autenticado da requisição atual. O {@code JwtAuthenticationFilter}
 * guarda só o id do usuário como principal (uma String) - centralizar a resolução aqui evita
 * espalhar esse parsing pelos controllers que precisam saber "quem está fazendo esta ação".
 */
@Component
public class ContextoUsuarioAutenticado {

    private final UsuarioRepository usuarioRepository;

    public ContextoUsuarioAutenticado(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    public Usuario usuarioAtual() {
        String principal = SecurityContextHolder.getContext().getAuthentication().getName();
        Long usuarioId = Long.valueOf(principal);

        return usuarioRepository
                .findById(usuarioId)
                .orElseThrow(() -> new IllegalStateException("Usuário autenticado não encontrado: " + usuarioId));
    }
}
