package io.escritor.presenca.kanban.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EtiquetaTest {

    private final Quadro quadro = new Quadro("Backlog", null);

    @Test
    void etiquetaValida() {
        Etiqueta etiqueta = new Etiqueta(quadro, "Urgente", "#FF0000");

        assertThat(etiqueta.getQuadro()).isSameAs(quadro);
        assertThat(etiqueta.getNome()).isEqualTo("Urgente");
        assertThat(etiqueta.getCor()).isEqualTo("#FF0000");
    }

    @Test
    void nomeEmBrancoLancaExcecao() {
        assertThatThrownBy(() -> new Etiqueta(quadro, "   ", "#FF0000"))
                .isInstanceOf(NomeEtiquetaObrigatorioException.class);
    }

    @Test
    void nomeNuloLancaExcecao() {
        assertThatThrownBy(() -> new Etiqueta(quadro, null, "#FF0000"))
                .isInstanceOf(NomeEtiquetaObrigatorioException.class);
    }

    @Test
    void corEmBrancoLancaExcecao() {
        assertThatThrownBy(() -> new Etiqueta(quadro, "Urgente", "   "))
                .isInstanceOf(CorEtiquetaObrigatoriaException.class);
    }

    @Test
    void corNulaLancaExcecao() {
        assertThatThrownBy(() -> new Etiqueta(quadro, "Urgente", null))
                .isInstanceOf(CorEtiquetaObrigatoriaException.class);
    }
}
