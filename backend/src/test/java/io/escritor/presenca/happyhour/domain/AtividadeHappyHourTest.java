package io.escritor.presenca.happyhour.domain;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import java.time.Instant;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AtividadeHappyHourTest {

    private final Usuario sugerida = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);

    @Test
    void nasceComOsDadosEsemSorteioAinda() {
        Instant criadaEm = Instant.parse("2026-01-13T18:00:00Z");

        AtividadeHappyHour atividade = new AtividadeHappyHour("Karaokê", sugerida, criadaEm);

        assertThat(atividade.getDescricao()).isEqualTo("Karaokê");
        assertThat(atividade.getSugeridaPor()).isSameAs(sugerida);
        assertThat(atividade.getCriadaEm()).isEqualTo(criadaEm);
        assertThat(atividade.getSorteadaEm()).isNull();
    }

    @Test
    void descricaoEmBrancoLancaExcecao() {
        assertThatThrownBy(() -> new AtividadeHappyHour("   ", sugerida, Instant.now()))
                .isInstanceOf(DescricaoAtividadeObrigatoriaException.class);
    }

    @Test
    void descricaoNulaLancaExcecao() {
        assertThatThrownBy(() -> new AtividadeHappyHour(null, sugerida, Instant.now()))
                .isInstanceOf(DescricaoAtividadeObrigatoriaException.class);
    }

    @Test
    void sortearMarcaOMomentoEDesmarcarLimpa() {
        AtividadeHappyHour atividade = new AtividadeHappyHour("Karaokê", sugerida, Instant.now());
        Instant sorteadaEm = Instant.parse("2026-01-13T19:00:00Z");

        atividade.sortear(sorteadaEm);
        assertThat(atividade.getSorteadaEm()).isEqualTo(sorteadaEm);

        atividade.desmarcarSorteio();
        assertThat(atividade.getSorteadaEm()).isNull();
    }
}
