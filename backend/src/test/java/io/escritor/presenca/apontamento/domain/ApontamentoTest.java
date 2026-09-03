package io.escritor.presenca.apontamento.domain;

import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Projeto;
import io.escritor.presenca.identidade.domain.StatusProjeto;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ApontamentoTest {

    private final Projeto projeto = new Projeto("Backlog", "Cliente Teste", StatusProjeto.ATIVO, LocalDate.now(), null);
    private final Coluna coluna = new Coluna(projeto, "A fazer", 0, null);
    private final Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
    private final Card card = new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, usuario);
    private final Instant inicio = Instant.parse("2026-01-15T09:00:00Z");

    /**
     * O construtor ainda aceita {@code fim} nulo (sem calcular `minutos`) mesmo depois da remoção
     * do "Iniciar timer" - é o formato dos registros legados de {@link OrigemApontamento#TIMER}
     * que continuam existindo no banco.
     */
    @Test
    void criarSemFimNaoTemMinutosCalculadoAinda() {
        Apontamento apontamento = new Apontamento(usuario, card, inicio, null, null, OrigemApontamento.TIMER);

        assertThat(apontamento.getUsuario()).isSameAs(usuario);
        assertThat(apontamento.getCard()).isSameAs(card);
        assertThat(apontamento.getInicio()).isEqualTo(inicio);
        assertThat(apontamento.getFim()).isNull();
        assertThat(apontamento.getMinutos()).isNull();
        assertThat(apontamento.getOrigem()).isEqualTo(OrigemApontamento.TIMER);
        assertThat(apontamento.getCriadoEm()).isNotNull();
        assertThat(apontamento.getEditadoEm()).isNotNull();
    }

    @Test
    void criarComFimJaCalculaMinutos() {
        Instant fim = inicio.plus(90, ChronoUnit.MINUTES);

        Apontamento apontamento = new Apontamento(usuario, card, inicio, fim, "Revisão de código", OrigemApontamento.MANUAL);

        assertThat(apontamento.getMinutos()).isEqualTo(90);
        assertThat(apontamento.getDescricao()).isEqualTo("Revisão de código");
    }

    @Test
    void criarComFimAntesDoInicioLancaExcecao() {
        Instant fimInvalido = inicio.minus(1, ChronoUnit.MINUTES);

        assertThatThrownBy(() -> new Apontamento(usuario, card, inicio, fimInvalido, null, OrigemApontamento.MANUAL))
                .isInstanceOf(FimAntesDoInicioException.class);
    }

    @Test
    void editarIntervaloRecalculaMinutos() {
        Apontamento apontamento =
                new Apontamento(usuario, card, inicio, inicio.plus(30, ChronoUnit.MINUTES), "Original", OrigemApontamento.MANUAL);

        apontamento.editar(inicio, inicio.plus(90, ChronoUnit.MINUTES), null);

        assertThat(apontamento.getFim()).isEqualTo(inicio.plus(90, ChronoUnit.MINUTES));
        assertThat(apontamento.getMinutos()).isEqualTo(90);
        assertThat(apontamento.getDescricao()).isEqualTo("Original");
    }

    @Test
    void editarDescricaoNaoMexeNoIntervalo() {
        Apontamento apontamento =
                new Apontamento(usuario, card, inicio, inicio.plus(30, ChronoUnit.MINUTES), "Original", OrigemApontamento.MANUAL);

        apontamento.editar(null, null, "Corrigido");

        assertThat(apontamento.getInicio()).isEqualTo(inicio);
        assertThat(apontamento.getFim()).isEqualTo(inicio.plus(30, ChronoUnit.MINUTES));
        assertThat(apontamento.getMinutos()).isEqualTo(30);
        assertThat(apontamento.getDescricao()).isEqualTo("Corrigido");
    }

    @Test
    void editarSoOInicioMantemOFimERecalculaMinutos() {
        Apontamento apontamento =
                new Apontamento(usuario, card, inicio, inicio.plus(60, ChronoUnit.MINUTES), null, OrigemApontamento.MANUAL);

        apontamento.editar(inicio.plus(30, ChronoUnit.MINUTES), null, null);

        assertThat(apontamento.getInicio()).isEqualTo(inicio.plus(30, ChronoUnit.MINUTES));
        assertThat(apontamento.getFim()).isEqualTo(inicio.plus(60, ChronoUnit.MINUTES));
        assertThat(apontamento.getMinutos()).isEqualTo(30);
    }

    @Test
    void editarComFimAntesDoInicioLancaExcecaoENaoMudaNada() {
        Apontamento apontamento =
                new Apontamento(usuario, card, inicio, inicio.plus(30, ChronoUnit.MINUTES), null, OrigemApontamento.MANUAL);

        assertThatThrownBy(() -> apontamento.editar(inicio.plus(60, ChronoUnit.MINUTES), null, null))
                .isInstanceOf(FimAntesDoInicioException.class);

        assertThat(apontamento.getInicio()).isEqualTo(inicio);
        assertThat(apontamento.getFim()).isEqualTo(inicio.plus(30, ChronoUnit.MINUTES));
    }

    @Test
    void editarUmApontamentoLegadoSemFimContinuaSemMinutos() {
        Apontamento apontamento = new Apontamento(usuario, card, inicio, null, null, OrigemApontamento.TIMER);

        apontamento.editar(inicio.plus(5, ChronoUnit.MINUTES), null, "Ajuste de início");

        assertThat(apontamento.getFim()).isNull();
        assertThat(apontamento.getMinutos()).isNull();
        assertThat(apontamento.getDescricao()).isEqualTo("Ajuste de início");
    }
}
