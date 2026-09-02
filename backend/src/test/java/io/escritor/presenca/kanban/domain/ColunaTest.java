package io.escritor.presenca.kanban.domain;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ColunaTest {

    private final Projeto projeto = new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null);

    @Test
    void colunaValidaSemLimiteWip() {
        Coluna coluna = new Coluna(projeto, "A fazer", 0, null);

        assertThat(coluna.getProjeto()).isSameAs(projeto);
        assertThat(coluna.getNome()).isEqualTo("A fazer");
        assertThat(coluna.getOrdem()).isEqualTo(0);
        assertThat(coluna.getLimiteWip()).isNull();
    }

    @Test
    void colunaValidaComLimiteWip() {
        Coluna coluna = new Coluna(projeto, "Em progresso", 1, 3);

        assertThat(coluna.getLimiteWip()).isEqualTo(3);
    }

    @Test
    void nomeEmBrancoLancaExcecao() {
        assertThatThrownBy(() -> new Coluna(projeto, "   ", 0, null))
                .isInstanceOf(NomeColunaObrigatorioException.class);
    }

    @Test
    void nomeNuloLancaExcecao() {
        assertThatThrownBy(() -> new Coluna(projeto, null, 0, null))
                .isInstanceOf(NomeColunaObrigatorioException.class);
    }

    @Test
    void limiteWipZeroLancaExcecao() {
        assertThatThrownBy(() -> new Coluna(projeto, "Em progresso", 1, 0))
                .isInstanceOf(LimiteWipInvalidoException.class);
    }

    @Test
    void limiteWipNegativoLancaExcecao() {
        assertThatThrownBy(() -> new Coluna(projeto, "Em progresso", 1, -1))
                .isInstanceOf(LimiteWipInvalidoException.class);
    }
}
