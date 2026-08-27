package io.escritor.presenca.identidade.service;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.identidade.repository.UsuarioRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContextoUsuarioAutenticadoTest {

    @Mock
    private UsuarioRepository usuarioRepository;

    @AfterEach
    void limparContexto() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void resolveOUsuarioPeloIdDoPrincipal() {
        Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 360);
        ReflectionTestUtils.setField(usuario, "id", 42L);
        when(usuarioRepository.findById(42L)).thenReturn(Optional.of(usuario));
        autenticarComo("42", "COLABORADOR");

        Usuario resolvido = new ContextoUsuarioAutenticado(usuarioRepository).usuarioAtual();

        assertThat(resolvido).isEqualTo(usuario);
    }

    @Test
    void lancaExcecaoSeOUsuarioDoTokenNaoExisteMais() {
        when(usuarioRepository.findById(99L)).thenReturn(Optional.empty());
        autenticarComo("99", "COLABORADOR");

        assertThatThrownBy(() -> new ContextoUsuarioAutenticado(usuarioRepository).usuarioAtual())
                .isInstanceOf(IllegalStateException.class);
    }

    private void autenticarComo(String usuarioId, String papel) {
        var authentication = new UsernamePasswordAuthenticationToken(
                usuarioId, null, List.of(new SimpleGrantedAuthority("ROLE_" + papel)));
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }
}
