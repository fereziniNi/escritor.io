package io.escritor.presenca.kanban.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ColunaTest {

    private final Quadro quadro = new Quadro("Backlog", null);

    @Test
    void colunaValidaSemLimiteWip() {
        Coluna coluna = new Coluna(quadro, "A fazer", 0, null);

        assertThat(coluna.getQuadro()).isSameAs(quadro);
        assertThat(coluna.getNome()).isEqualTo("A fazer");
        assertThat(coluna.getOrdem()).isEqualTo(0);
        assertThat(coluna.getLimiteWip()).isNull();
    }

    @Test
    void colunaValidaComLimiteWip() {
        Coluna coluna = new Coluna(quadro, "Em progresso", 1, 3);

        assertThat(coluna.getLimiteWip()).isEqualTo(3);
    }

    @Test
    void nomeEmBrancoLancaExcecao() {
        assertThatThrownBy(() -> new Coluna(quadro, "   ", 0, null))
                .isInstanceOf(NomeColunaObrigatorioException.class);
    }

    @Test
    void nomeNuloLancaExcecao() {
        assertThatThrownBy(() -> new Coluna(quadro, null, 0, null))
                .isInstanceOf(NomeColunaObrigatorioException.class);
    }

    @Test
    void limiteWipZeroLancaExcecao() {
        assertThatThrownBy(() -> new Coluna(quadro, "Em progresso", 1, 0))
                .isInstanceOf(LimiteWipInvalidoException.class);
    }

    @Test
    void limiteWipNegativoLancaExcecao() {
        assertThatThrownBy(() -> new Coluna(quadro, "Em progresso", 1, -1))
                .isInstanceOf(LimiteWipInvalidoException.class);
    }
}
