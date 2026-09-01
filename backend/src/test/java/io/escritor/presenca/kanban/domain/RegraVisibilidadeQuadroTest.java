package io.escritor.presenca.kanban.domain;

import java.util.Set;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RegraVisibilidadeQuadroTest {

    @Test
    void quadroDoQualUsuarioEMembroEVisivel() {
        boolean visivel = RegraVisibilidadeQuadro.visivel(10L, Set.of(10L, 20L));

        assertThat(visivel).isTrue();
    }

    @Test
    void quadroDoQualUsuarioNaoEMembroNaoEVisivel() {
        boolean visivel = RegraVisibilidadeQuadro.visivel(99L, Set.of(10L, 20L));

        assertThat(visivel).isFalse();
    }

    @Test
    void usuarioSemNenhumQuadroNaoVeNenhumQuadro() {
        boolean visivel = RegraVisibilidadeQuadro.visivel(10L, Set.of());

        assertThat(visivel).isFalse();
    }
}
