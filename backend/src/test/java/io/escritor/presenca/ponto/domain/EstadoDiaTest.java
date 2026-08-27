package io.escritor.presenca.ponto.domain;

import static io.escritor.presenca.ponto.domain.TipoRegistroPonto.ENTRADA;
import static io.escritor.presenca.ponto.domain.TipoRegistroPonto.PAUSA_INICIO;
import static io.escritor.presenca.ponto.domain.TipoRegistroPonto.SAIDA;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class EstadoDiaTest {

    private static final Instant INICIO_DIA = Instant.parse("2026-01-15T00:00:00Z");
    private static final Instant FIM_DIA = Instant.parse("2026-01-16T00:00:00Z");

    @Test
    void diaComSaidaEstaFechado() {
        List<Marcacao> registros = List.of(
                new Marcacao(ENTRADA, Instant.parse("2026-01-15T09:00:00Z")),
                new Marcacao(SAIDA, Instant.parse("2026-01-15T18:00:00Z")));

        Instant agoraAntesDaVirada = Instant.parse("2026-01-15T20:00:00Z");
        Instant agoraDepoisDaVirada = Instant.parse("2026-01-17T10:00:00Z");

        assertThat(EstadoDia.calcular(registros, FIM_DIA, agoraAntesDaVirada)).isEqualTo(EstadoDia.FECHADA);
        assertThat(EstadoDia.calcular(registros, FIM_DIA, agoraDepoisDaVirada)).isEqualTo(EstadoDia.FECHADA);
    }

    @Test
    void diaSemSaidaAindaDentroDoExpedienteEstaAberto() {
        List<Marcacao> registros = List.of(new Marcacao(ENTRADA, Instant.parse("2026-01-15T09:00:00Z")));
        Instant agora = Instant.parse("2026-01-15T18:00:00Z");

        assertThat(EstadoDia.calcular(registros, FIM_DIA, agora)).isEqualTo(EstadoDia.ABERTA);
    }

    @Test
    void diaSemSaidaAposAViradaEstaInconsistente() {
        List<Marcacao> registros = List.of(new Marcacao(ENTRADA, Instant.parse("2026-01-15T09:00:00Z")));
        Instant agora = Instant.parse("2026-01-16T08:00:00Z");

        assertThat(EstadoDia.calcular(registros, FIM_DIA, agora)).isEqualTo(EstadoDia.INCONSISTENTE);
    }

    @Test
    void diaComUltimaMarcacaoEmPausaAposAViradaEstaInconsistente() {
        List<Marcacao> registros = List.of(
                new Marcacao(ENTRADA, Instant.parse("2026-01-15T09:00:00Z")),
                new Marcacao(PAUSA_INICIO, Instant.parse("2026-01-15T12:00:00Z")));
        Instant agora = Instant.parse("2026-01-16T00:00:01Z");

        assertThat(EstadoDia.calcular(registros, FIM_DIA, agora)).isEqualTo(EstadoDia.INCONSISTENTE);
    }

    @Test
    void noInstanteExatoDaViradaSemSaidaJaEstaInconsistente() {
        List<Marcacao> registros = List.of(new Marcacao(ENTRADA, Instant.parse("2026-01-15T09:00:00Z")));

        assertThat(EstadoDia.calcular(registros, FIM_DIA, FIM_DIA)).isEqualTo(EstadoDia.INCONSISTENTE);
    }

    @Test
    void diaSemNenhumaMarcacaoEstaAberto() {
        assertThat(EstadoDia.calcular(List.of(), FIM_DIA, INICIO_DIA)).isEqualTo(EstadoDia.ABERTA);
    }
}
