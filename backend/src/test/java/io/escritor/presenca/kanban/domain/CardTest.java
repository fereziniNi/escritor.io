package io.escritor.presenca.kanban.domain;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CardTest {

    private final Projeto projeto = new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null);
    private final Coluna coluna = new Coluna(projeto, "A fazer", 0, null);
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

    @Test
    void moverAtualizaColunaEPosicao() {
        Card card = new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, criadoPor);
        Coluna outraColuna = new Coluna(projeto, "Em progresso", 1, null);

        card.mover(outraColuna, 2048.0);

        assertThat(card.getColuna()).isSameAs(outraColuna);
        assertThat(card.getPosicao()).isEqualTo(2048.0);
    }

    @Test
    void moverDentroDaMesmaColunaSoMudaAPosicao() {
        Card card = new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, criadoPor);

        card.mover(coluna, 512.0);

        assertThat(card.getColuna()).isSameAs(coluna);
        assertThat(card.getPosicao()).isEqualTo(512.0);
    }
}
