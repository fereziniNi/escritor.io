package io.escritor.presenca.identidade.domain;

import java.util.Set;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RegraVisibilidadeProjetoTest {

    @Test
    void projetoDoQualUsuarioEMembroEVisivel() {
        boolean visivel = RegraVisibilidadeProjeto.visivel(10L, Set.of(10L, 20L));

        assertThat(visivel).isTrue();
    }

    @Test
    void projetoDoQualUsuarioNaoEMembroNaoEVisivel() {
        boolean visivel = RegraVisibilidadeProjeto.visivel(99L, Set.of(10L, 20L));

        assertThat(visivel).isFalse();
    }

    @Test
    void usuarioSemNenhumProjetoNaoVeNenhumProjeto() {
        boolean visivel = RegraVisibilidadeProjeto.visivel(10L, Set.of());

        assertThat(visivel).isFalse();
    }
}
