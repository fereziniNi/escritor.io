package io.escritor.presenca.kanban.domain;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CardTest {

    private final Quadro quadro = new Quadro("Backlog", null, new Equipe("Backend", null));
    private final Coluna coluna = new Coluna(quadro, "A fazer", 0, null);
    private final Usuario criadoPor = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);

    @Test
    void cardMinimoSoComTitulo() {
        Card card = new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, criadoPor);

        assertThat(card.getColuna()).isSameAs(coluna);
        assertThat(card.getTitulo()).isEqualTo("Corrigir bug");
        assertThat(card.getDescricao()).isNull();
        assertThat(card.getPosicao()).isEqualTo(1024.0);
        assertThat(card.getResponsavel()).isNull();
        assertThat(card.getPrazo()).isNull();
        assertThat(card.getEstimativaMinutos()).isNull();
        assertThat(card.getCriadoPor()).isSameAs(criadoPor);
        assertThat(card.getCriadoEm()).isNotNull();
        assertThat(card.isArquivado()).isFalse();
    }

    @Test
    void cardCompletoComTodosOsCampos() {
        Usuario responsavel = new Usuario("Beto Lima", "beto@escritor.io", Papel.COLABORADOR, 480);
        LocalDate prazo = LocalDate.of(2026, 3, 1);

        Card card = new Card(coluna, "Corrigir bug", "Descrição em markdown", 1024.0, responsavel, prazo, 120, criadoPor);

        assertThat(card.getResponsavel()).isSameAs(responsavel);
        assertThat(card.getPrazo()).isEqualTo(prazo);
        assertThat(card.getEstimativaMinutos()).isEqualTo(120);
    }

    @Test
    void tituloEmBrancoLancaExcecao() {
        assertThatThrownBy(() -> new Card(coluna, "   ", null, 1024.0, null, null, null, criadoPor))
                .isInstanceOf(TituloCardObrigatorioException.class);
    }

    @Test
    void tituloNuloLancaExcecao() {
        assertThatThrownBy(() -> new Card(coluna, null, null, 1024.0, null, null, null, criadoPor))
                .isInstanceOf(TituloCardObrigatorioException.class);
    }

    @Test
    void estimativaZeroLancaExcecao() {
        assertThatThrownBy(() -> new Card(coluna, "Corrigir bug", null, 1024.0, null, null, 0, criadoPor))
                .isInstanceOf(EstimativaInvalidaException.class);
    }

    @Test
    void estimativaNegativaLancaExcecao() {
        assertThatThrownBy(() -> new Card(coluna, "Corrigir bug", null, 1024.0, null, null, -30, criadoPor))
                .isInstanceOf(EstimativaInvalidaException.class);
    }
}
