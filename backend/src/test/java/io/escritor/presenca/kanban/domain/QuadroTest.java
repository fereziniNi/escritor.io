package io.escritor.presenca.kanban.domain;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class QuadroTest {

    private final Equipe equipe = new Equipe("Backend", null);
    private final Projeto projeto = new Projeto("Site novo", "Acme", StatusProjeto.ATIVO, LocalDate.now(), null);

    @Test
    void quadroSoDeProjetoEValido() {
        Quadro quadro = new Quadro("Backlog", projeto, null);

        assertThat(quadro.getProjeto()).isSameAs(projeto);
        assertThat(quadro.getEquipe()).isNull();
        assertThat(quadro.isArquivado()).isFalse();
    }

    @Test
    void quadroSoDeEquipeEValido() {
        Quadro quadro = new Quadro("Interno", null, equipe);

        assertThat(quadro.getEquipe()).isSameAs(equipe);
        assertThat(quadro.getProjeto()).isNull();
    }

    @Test
    void quadroDeProjetoEEquipeJuntosEValido() {
        Quadro quadro = new Quadro("Time X no projeto Y", projeto, equipe);

        assertThat(quadro.getProjeto()).isSameAs(projeto);
        assertThat(quadro.getEquipe()).isSameAs(equipe);
    }

    @Test
    void quadroSemProjetoNemEquipeLancaExcecao() {
        assertThatThrownBy(() -> new Quadro("Órfão", null, null)).isInstanceOf(QuadroSemVinculoException.class);
    }

    @Test
    void nomeEmBrancoLancaExcecao() {
        assertThatThrownBy(() -> new Quadro("   ", projeto, null)).isInstanceOf(NomeQuadroObrigatorioException.class);
    }

    @Test
    void nomeNuloLancaExcecao() {
        assertThatThrownBy(() -> new Quadro(null, projeto, null)).isInstanceOf(NomeQuadroObrigatorioException.class);
    }
}
