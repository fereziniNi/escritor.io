package io.escritor.presenca.kanban.domain;

import java.util.Set;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RegraVisibilidadeQuadroTest {

    @Test
    void quadroDaEquipeDoUsuarioEVisivel() {
        boolean visivel =
                RegraVisibilidadeQuadro.visivel(10L, null, Set.of(10L, 20L), Set.of());

        assertThat(visivel).isTrue();
    }

    @Test
    void quadroDeEquipeQueUsuarioNaoParticipaNaoEVisivel() {
        boolean visivel =
                RegraVisibilidadeQuadro.visivel(99L, null, Set.of(10L, 20L), Set.of());

        assertThat(visivel).isFalse();
    }

    @Test
    void quadroDoProjetoVinculadoAEquipeDoUsuarioEVisivel() {
        boolean visivel =
                RegraVisibilidadeQuadro.visivel(null, 5L, Set.of(10L), Set.of(5L, 6L));

        assertThat(visivel).isTrue();
    }

    @Test
    void quadroDeProjetoNaoVinculadoANenhumaEquipeDoUsuarioNaoEVisivel() {
        boolean visivel =
                RegraVisibilidadeQuadro.visivel(null, 99L, Set.of(10L), Set.of(5L, 6L));

        assertThat(visivel).isFalse();
    }

    @Test
    void quadroDeProjetoEEquipeEVisivelSeQualquerUmBater() {
        // equipe do quadro não é do usuário, mas o projeto do quadro é de uma equipe que é
        boolean visivel =
                RegraVisibilidadeQuadro.visivel(99L, 5L, Set.of(10L), Set.of(5L));

        assertThat(visivel).isTrue();
    }

    @Test
    void usuarioSemNenhumaEquipeNaoVeNenhumQuadro() {
        boolean visivel = RegraVisibilidadeQuadro.visivel(10L, 5L, Set.of(), Set.of());

        assertThat(visivel).isFalse();
    }
}
