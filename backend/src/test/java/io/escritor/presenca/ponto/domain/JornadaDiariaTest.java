package io.escritor.presenca.ponto.domain;

import static io.escritor.presenca.ponto.domain.TipoRegistroPonto.ENTRADA;
import static io.escritor.presenca.ponto.domain.TipoRegistroPonto.PAUSA_FIM;
import static io.escritor.presenca.ponto.domain.TipoRegistroPonto.PAUSA_INICIO;
import static io.escritor.presenca.ponto.domain.TipoRegistroPonto.SAIDA;
import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class JornadaDiariaTest {

    private static Marcacao marcacao(TipoRegistroPonto tipo, String horario) {
        return new Marcacao(tipo, Instant.parse("2026-01-15T" + horario + ":00Z"));
    }

    @Test
    void jornadaSimplesSemPausa() {
        List<Marcacao> registros = List.of(marcacao(ENTRADA, "09:00"), marcacao(SAIDA, "18:00"));

        assertThat(JornadaDiaria.minutosTrabalhados(registros)).isEqualTo(9 * 60);
        assertThat(JornadaDiaria.saldo(registros, 480)).isEqualTo(60);
    }

    @Test
    void descontaUmaPausa() {
        List<Marcacao> registros = List.of(
                marcacao(ENTRADA, "09:00"),
                marcacao(PAUSA_INICIO, "12:00"),
                marcacao(PAUSA_FIM, "13:00"),
                marcacao(SAIDA, "18:00"));

        assertThat(JornadaDiaria.minutosTrabalhados(registros)).isEqualTo(8 * 60);
        assertThat(JornadaDiaria.saldo(registros, 480)).isZero();
    }

    @Test
    void descontaMultiplasPausas() {
        List<Marcacao> registros = List.of(
                marcacao(ENTRADA, "09:00"),
                marcacao(PAUSA_INICIO, "10:00"),
                marcacao(PAUSA_FIM, "10:15"),
                marcacao(PAUSA_INICIO, "12:00"),
                marcacao(PAUSA_FIM, "13:00"),
                marcacao(SAIDA, "18:00"));

        assertThat(JornadaDiaria.minutosTrabalhados(registros)).isEqualTo(9 * 60 - 15 - 60);
    }

    @Test
    void pausaSemFimNaoContaComoTrabalhadaNemComoDesconto() {
        List<Marcacao> registros = List.of(marcacao(ENTRADA, "09:00"), marcacao(PAUSA_INICIO, "12:00"));

        assertThat(JornadaDiaria.minutosTrabalhados(registros)).isZero();
    }

    @Test
    void entradaSemSaidaNaoContaMinutos() {
        List<Marcacao> registros = List.of(marcacao(ENTRADA, "09:00"));

        assertThat(JornadaDiaria.minutosTrabalhados(registros)).isZero();
    }

    @Test
    void jornadaCruzandoMeiaNoiteSomaNormalmente() {
        List<Marcacao> registros = List.of(
                new Marcacao(ENTRADA, Instant.parse("2026-01-15T23:50:00Z")),
                new Marcacao(SAIDA, Instant.parse("2026-01-16T00:10:00Z")));

        assertThat(JornadaDiaria.minutosTrabalhados(registros)).isEqualTo(20);
    }

    @Test
    void saldoPodeSerNegativo() {
        List<Marcacao> registros = List.of(marcacao(ENTRADA, "09:00"), marcacao(SAIDA, "12:00"));

        assertThat(JornadaDiaria.saldo(registros, 480)).isEqualTo(3 * 60 - 480);
    }

    @Test
    void listaVaziaNaoTrabalhouNada() {
        assertThat(JornadaDiaria.minutosTrabalhados(List.of())).isZero();
    }
}
