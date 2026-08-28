package io.escritor.presenca.apontamento.domain;

import io.escritor.presenca.identidade.domain.Equipe;
import io.escritor.presenca.identidade.domain.Papel;
import io.escritor.presenca.identidade.domain.Usuario;
import io.escritor.presenca.kanban.domain.Card;
import io.escritor.presenca.kanban.domain.Coluna;
import io.escritor.presenca.kanban.domain.Quadro;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ApontamentoTest {

    private final Quadro quadro = new Quadro("Backlog", null, new Equipe("Backend", null));
    private final Coluna coluna = new Coluna(quadro, "A fazer", 0, null);
    private final Usuario usuario = new Usuario("Ana Souza", "ana@escritor.io", Papel.COLABORADOR, 480);
    private final Card card = new Card(coluna, "Corrigir bug", null, 1024.0, null, null, null, usuario);
    private final Instant inicio = Instant.parse("2026-01-15T09:00:00Z");

    @Test
    void abrirTimerSemFimNaoTemMinutosCalculadoAinda() {
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
    void encerrarCalculaMinutos() {
        Apontamento apontamento = new Apontamento(usuario, card, inicio, null, null, OrigemApontamento.TIMER);
        Instant fim = inicio.plus(45, ChronoUnit.MINUTES);

        apontamento.encerrar(fim);

        assertThat(apontamento.getFim()).isEqualTo(fim);
        assertThat(apontamento.getMinutos()).isEqualTo(45);
    }

    @Test
    void encerrarComFimAntesDoInicioLancaExcecao() {
        Apontamento apontamento = new Apontamento(usuario, card, inicio, null, null, OrigemApontamento.TIMER);

        assertThatThrownBy(() -> apontamento.encerrar(inicio.minus(1, ChronoUnit.MINUTES)))
                .isInstanceOf(FimAntesDoInicioException.class);
    }

    @Test
    void encerrarUmApontamentoJaEncerradoLancaExcecao() {
        Apontamento apontamento = new Apontamento(usuario, card, inicio, inicio.plus(30, ChronoUnit.MINUTES), null, OrigemApontamento.TIMER);

        assertThatThrownBy(() -> apontamento.encerrar(inicio.plus(60, ChronoUnit.MINUTES)))
                .isInstanceOf(ApontamentoJaEncerradoException.class);
    }
}
