package io.escritor.presenca.kanban.domain;

import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class QuadroTest {

    private final Projeto projeto = new Projeto("Site novo", "Acme", StatusProjeto.ATIVO, LocalDate.now(), null);

    @Test
    void quadroDeProjetoEValido() {
        Quadro quadro = new Quadro("Backlog", projeto);

        assertThat(quadro.getProjeto()).isSameAs(projeto);
        assertThat(quadro.isArquivado()).isFalse();
    }

    /**
     * Pedido do cliente: sem Equipe - quadro (o "sistema") não precisa mais de vínculo nenhum, a
     * visibilidade agora é atribuição individual via {@link MembroQuadro}.
     */
    @Test
    void quadroSemProjetoEValido() {
        Quadro quadro = new Quadro("Interno", null);

        assertThat(quadro.getProjeto()).isNull();
        assertThat(quadro.isArquivado()).isFalse();
    }

    @Test
    void nomeEmBrancoLancaExcecao() {
        assertThatThrownBy(() -> new Quadro("   ", projeto)).isInstanceOf(NomeQuadroObrigatorioException.class);
    }

    @Test
    void nomeNuloLancaExcecao() {
        assertThatThrownBy(() -> new Quadro(null, projeto)).isInstanceOf(NomeQuadroObrigatorioException.class);
    }
}
