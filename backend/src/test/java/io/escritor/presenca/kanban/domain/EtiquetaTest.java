package io.escritor.presenca.kanban.domain;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EtiquetaTest {

    private final Projeto projeto = new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null);

    @Test
    void etiquetaValida() {
        Etiqueta etiqueta = new Etiqueta(projeto, "Urgente", "#FF0000");

        assertThat(etiqueta.getProjeto()).isSameAs(projeto);
        assertThat(etiqueta.getNome()).isEqualTo("Urgente");
        assertThat(etiqueta.getCor()).isEqualTo("#FF0000");
    }

    @Test
    void nomeEmBrancoLancaExcecao() {
        assertThatThrownBy(() -> new Etiqueta(projeto, "   ", "#FF0000"))
                .isInstanceOf(NomeEtiquetaObrigatorioException.class);
    }

    @Test
    void nomeNuloLancaExcecao() {
        assertThatThrownBy(() -> new Etiqueta(projeto, null, "#FF0000"))
                .isInstanceOf(NomeEtiquetaObrigatorioException.class);
    }

    @Test
    void corEmBrancoLancaExcecao() {
        assertThatThrownBy(() -> new Etiqueta(projeto, "Urgente", "   "))
                .isInstanceOf(CorEtiquetaObrigatoriaException.class);
    }

    @Test
    void corNulaLancaExcecao() {
        assertThatThrownBy(() -> new Etiqueta(projeto, "Urgente", null))
                .isInstanceOf(CorEtiquetaObrigatoriaException.class);
    }
}
