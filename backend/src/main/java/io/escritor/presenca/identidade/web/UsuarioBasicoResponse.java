package io.escritor.presenca.identidade.web;

import io.escritor.presenca.identidade.domain.Usuario;

/**
 * Pedido do cliente: "quando for adicionar alguma pessoa ao projeto ou atividade, devemos
 * referenciar o nome dela e não o ID... a pessoa preenchendo o nome e já aparecer as pessoas
 * cadastradas" - versão enxuta de {@link UsuarioResponse} (só id/nome, nada de papel/carga
 * diária/email) pra alimentar autocomplete de "escolher uma pessoa" em qualquer lugar do sistema
 * sem precisar do {@code GET /usuarios} completo (esse continua ADMIN-only, ver
 * {@code UsuarioController}).
 */
public record UsuarioBasicoResponse(Long id, String nome) {

    public static UsuarioBasicoResponse de(Usuario usuario) {
        return new UsuarioBasicoResponse(usuario.getId(), usuario.getNome());
    }
}
